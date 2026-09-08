"use client";

import {devLog} from "@/lib/devLog";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {buildBindingIndex, type BindingIndex} from "@/lib/runtime/bindingIndex";
import type {CompiledBinding} from "@/lib/runtime/executeBinding";
import {hasKnownTrigger, runBindings} from "@/lib/runtime/runBindings";
import {collectTagScope, withPropertyRefs} from "@/lib/runtime/bindingScope";
import {compileEventScript, executeEventScript} from "@/lib/runtime/eventScript";
import {
  setRuntimeEventHandler,
  setRuntimeLive,
  setRuntimeScriptHandler,
  setRuntimeSessionGetter,
  setRuntimeTagWriteHandler,
  setRuntimeValueGetter,
} from "@/lib/runtime/runtimeEventBus";
import {openRuntimeConnection, type RuntimeConnection, type RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import {cellRuntimeKey} from "@/lib/editor/tableCells";
import {cellBindings, isLiveField, propertyByName} from "@/lib/editor/tableBindings";
import type {ElementEventName} from "@/types/binding.types";
import type {DiagramElement} from "@/types/editorElement.type";

/** Тик применения батча: сервер и так батчит ~40мс, 5 Гц на рендер достаточно. */
const FLUSH_INTERVAL_MS = 200;
/** Соединение "live", но кадров нет дольше этого — считаем данные устаревшими
 *  (обрыв Kafka-консьюмера на бэкенде не рвёт WS, ts — единственный признак). */
const STALE_THRESHOLD_MS = 10_000;

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/** quality отсутствует или "GOOD" — достоверно; всё остальное — нет (не сравнивать на "BAD"). */
const isTagQualityGood = (quality?: string) => quality === undefined || quality === "GOOD";

const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every(k => b.has(k));

/**
 * Элементы, у которых хотя бы один тег-свойство сейчас недостоверен (quality != GOOD)
 * ИЛИ по нему ещё не было ни одного сообщения (холодный старт, docs/contract/TAG_CONTRACT_CHANGES.md B4).
 */
const computeNoDataElementKeys = (
  idx: BindingIndex,
  tagMeta: ReadonlyMap<string, {quality: string; ts?: number}>,
): Set<string> => {
  const result = new Set<string>();
  for (const [tagId, keys] of idx.elementKeysByTagId) {
    const meta = tagMeta.get(tagId);
    const bad = !meta || !isTagQualityGood(meta.quality);
    if (bad) for (const k of keys) result.add(k);
  }
  return result;
};

export interface RuntimeEngineState {
  status: RuntimeStatus;
  /** binding.id → ошибка компиляции (биндинг не участвует в рантайме). */
  compileErrors: Map<string, string>;
  /** binding.id → последняя ошибка исполнения (после 5 подряд — автоотключение). */
  runtimeErrors: Map<string, string>;
  /** id текущей WS-сессии (для GET /snapshot) — null, пока не подключены. */
  sessionId: string | null;
  /** Причина отказа при status==="rejected" (e.reason из close-события 1003). */
  rejectionReason: string | null;
  /** true — соединение "live", но кадров нет дольше STALE_THRESHOLD_MS (см. useRuntimeEngine.ts). */
  isStale: boolean;
}

/**
 * Движок биндингов режима монитора: держит рантайм-сессию (raw WS на :8085),
 * коалесирует входящие значения тегов (last-write-wins на тег), тикает 5 Гц и
 * применяет интенты одним applyRuntimeBatch (один set() → один ре-рендер сцены,
 * сколько бы тегов ни изменилось). elements не мутируются — ни undo, ни автосейв
 * рантайм не видят.
 */
export function useRuntimeEngine(active: boolean): RuntimeEngineState {
  const elements = useEditorStore(s => s.elements);
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);

  const [status, setStatus] = useState<RuntimeStatus>("closed");
  const [runtimeErrors, setRuntimeErrors] = useState<Map<string, string>>(new Map());
  // Зеркало runtimeErrors для прогонов вне рендера. Без него flush пришлось бы держать
  // runtimeErrors в deps (пересоздание колбэка на каждую ошибку), а повторный прогон из
  // эффекта читал бы устаревшую карту из замыкания.
  const runtimeErrorsRef = useRef(runtimeErrors);
  const publishRuntimeErrors = useCallback((next: ReadonlyMap<string, string>) => {
    const prev = runtimeErrorsRef.current;
    // Та же карта либо «пусто было, пусто и осталось» — лишний setState перерисовал бы
    // шапку монитора на каждом тике и на каждом открытии схемы без единой ошибки.
    if (next === prev || (next.size === 0 && prev.size === 0)) return;
    const map = next instanceof Map ? next : new Map(next);
    runtimeErrorsRef.current = map;
    setRuntimeErrors(map);
  }, []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  // Момент последнего непустого UPDATE-кадра — обрыв Kafka-консьюмера на бэкенде
  // не рвёт WS, поэтому статус может оставаться "live" при замерших значениях;
  // единственный признак — переставший расти ts/момент приёма кадра.
  const lastMessageAtRef = useRef(0);
  // Живое зеркало status для интервала проверки устаревания (эффект соединения
  // создаётся один раз на (active, projectId), status в его замыкании был бы старым).
  const statusRef = useRef<RuntimeStatus>(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Компиляция один раз на identity elements (загрузка/пересохранение сцены).
  const index = useMemo(
    () => (active ? buildBindingIndex(elements) : null),
    [active, elements],
  );
  const indexRef = useRef(index);
  indexRef.current = index;

  // Коалесинг-буфер тика (tag_id → последнее значение) и последние известные
  // значения всех тегов скоупа (аргументы для исполнения биндингов). value может
  // быть null — тег с quality != GOOD без последнего достоверного значения.
  const pendingRef = useRef(new Map<string, string | null>());
  const valuesRef = useRef(new Map<string, string | null>());
  // Последнее известное качество/момент снятия по тегу (docs/contract/TAG_CONTRACT_CHANGES.md B1/B3).
  const tagMetaRef = useRef(new Map<string, {quality: string; ts?: number}>());
  // Взводится в onUpdate, когда quality хотя бы одного тега реально изменилось —
  // чтобы не пересчитывать noDataElementKeys на каждый тик без надобности.
  const qualityDirtyRef = useRef(false);
  // Последний набор "нет данных", отправленный в стор — для diff перед новым applyRuntimeBatch.
  const noDataKeysRef = useRef(new Set<string>());
  // Зеркальные буферы для свойств других компонентов (properties[] UPDATE),
  // ключ — propertyId.
  const pendingPropsRef = useRef(new Map<number, string>());
  const valuesByPropRef = useRef(new Map<number, string>());
  // Отдельный буфер по имени свойства — только для маршрутизации в ячейки строк
  // таблиц (propertyId нестабилен между пересохранениями таблицы, доку это и требует).
  const pendingPropNameRef = useRef(new Map<string, string>());
  const valuesByPropNameRef = useRef(new Map<string, string>());
  const errorCountRef = useRef(new Map<string, number>());
  const disabledRef = useRef(new Set<string>());
  // Активное WS-соединение — чтобы обработчик клика (runScript) мог послать ACTION.
  const connRef = useRef<RuntimeConnection | null>(null);

  const flush = useCallback(() => {
    const idx = indexRef.current;
    const pending = pendingRef.current;
    const pendingProps = pendingPropsRef.current;
    const pendingNames = pendingPropNameRef.current;
    if (!idx || (!pending.size && !pendingProps.size && !pendingNames.size)) return;
    pendingRef.current = new Map();
    pendingPropsRef.current = new Map();
    pendingPropNameRef.current = new Map();

    // Слой no-op №1: то же сырое значение — тег/свойство не считается изменившимся.
    //
    // Записанное оператором значение приходит сюда тем же путём, что и телеметрия (см.
    // мост записи ниже), и никакого приоритета не имеет: следующий кадр по этому тегу
    // просто перезапишет его. Именно поэтому показ не «залипает» на записанном.
    const affected = new Set<CompiledBinding>();
    const changedTags: {tagId: string; value: string | null}[] = [];
    for (const [tagId, value] of pending) {
      if (valuesRef.current.get(tagId) === value) continue;
      valuesRef.current.set(tagId, value);
      changedTags.push({tagId, value});
      for (const cb of idx.byTagId.get(tagId) ?? []) affected.add(cb);
    }

    // «Нет данных» (B2/B4): пересчитываем только если у какого-то тега реально
    // сменилось quality (взводится в onUpdate) — независимо от того, изменилось
    // ли при этом само значение (quality могла смениться при том же value).
    let noDataKeys: Set<string> | undefined;
    if (qualityDirtyRef.current) {
      qualityDirtyRef.current = false;
      const next = computeNoDataElementKeys(idx, tagMetaRef.current);
      if (!setsEqual(next, noDataKeysRef.current)) {
        noDataKeysRef.current = next;
        noDataKeys = next;
      }
    }
    const changedProps: {propertyId: number; value: string}[] = [];
    for (const [propertyId, value] of pendingProps) {
      if (valuesByPropRef.current.get(propertyId) === value) continue;
      valuesByPropRef.current.set(propertyId, value);
      changedProps.push({propertyId, value});
      for (const cb of idx.byPropertyId.get(propertyId) ?? []) affected.add(cb);
    }
    const changedNames: {name: string; value: string}[] = [];
    for (const [name, value] of pendingNames) {
      if (valuesByPropNameRef.current.get(name) === value) continue;
      valuesByPropNameRef.current.set(name, value);
      changedNames.push({name, value});
    }

    // Живые значения ячеек таблиц (тег- и локальные, маршрутизация по tag_id/имени,
    // НЕ через CompiledBinding — это не JS-биндинги, а прямая запись в ячейку,
    // адрес которой задан привязкой; см. tableBindings.ts).
    const tableRowProps: Record<string, Record<string, unknown>> = {};
    for (const {tagId, value} of changedTags) {
      for (const target of idx.tableCellsByTagId.get(tagId) ?? []) {
        (tableRowProps[target.elementKey] ??= {})[cellRuntimeKey(target.row, target.col)] = value;
      }
    }
    for (const {name, value} of changedNames) {
      for (const target of idx.tableCellsByPropertyName.get(name) ?? []) {
        (tableRowProps[target.elementKey] ??= {})[cellRuntimeKey(target.row, target.col)] = value;
      }
    }

    if (!affected.size && !Object.keys(tableRowProps).length && !noDataKeys) return;

    const store = useEditorStore.getState();
    const byKey = new Map(store.elements.map(el => [el.key, el] as const));

    // Тот же прогон, что и при смене схемы (см. эффект ниже) — одна трактовка ошибок
    // и автоотключения на оба пути.
    const {stateNameByKey, propsByKey, errors, fired} = runBindings(affected, {
      valuesByTagId: valuesRef.current,
      valuesByPropertyId: valuesByPropRef.current,
      selfOf: key => {
        const el = byKey.get(key);
        return el ? getRenderedElement(el) : null;
      },
      errorCounts: errorCountRef.current,
      disabled: disabledRef.current,
      knownErrors: runtimeErrorsRef.current,
    }, tableRowProps);

    publishRuntimeErrors(errors);

    console.groupCollapsed(
      `[monitor:engine] тик: изменилось тегов ${changedTags.length}, свойств ${changedProps.length}, локальных строк ${changedNames.length}, затронуто биндингов ${affected.size}, сработало ${fired.length}`,
    );
    if (changedTags.length) console.table(changedTags);
    if (changedProps.length) console.table(changedProps);
    if (changedNames.length) console.table(changedNames);
    if (fired.length) console.table(fired);
    console.groupEnd();

    if (Object.keys(stateNameByKey).length || Object.keys(propsByKey).length || noDataKeys) {
      // Слои no-op №2/№3 (то же состояние/значение, пустой батч) — внутри
      // applyRuntimeBatch: без фактических изменений set() не вызывается.
      log("применяю батч:", {stateNameByKey, propsByKey, noDataKeys});
      store.applyRuntimeBatch({stateNameByKey, propsByKey, noDataKeys});
    }
  }, [publishRuntimeErrors]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  /**
   * Открытие схемы: сид значений + ПОВТОРНЫЙ ПРОГОН биндингов по уже известным значениям.
   *
   * Индекс пересобирается на смену identity `elements`, то есть ровно тогда, когда на
   * холст лёг другой документ — это единственная надёжная точка «схема сменилась».
   * Соединение при этом не пересоздаётся (оно живёт на пару active+projectId), поэтому
   * значения тегов всей сессии остаются на руках, и открытая схема обязана нарисоваться
   * по ним сразу, а не ждать, пока значение изменится.
   *
   * Порядок внутри строгий: сначала сид значений свойств, потом прогон — иначе биндинги
   * прочитают свойства как null.
   */
  useEffect(() => {
    if (!active) return;
    const idx = indexRef.current;
    if (!idx) return;
    for (const el of useEditorStore.getState().elements) {
      for (const p of el.properties ?? []) {
        if (typeof p.id === "number" && idx.propertyIds.has(p.id) && !valuesByPropRef.current.has(p.id)) {
          valuesByPropRef.current.set(p.id, String(p.default_value ?? ""));
        }
      }
    }

    // Сид ячеек таблиц. Локальная строка до первого WS-апдейта показывает default_value
    // (доку: «до первого изменения»), но ТОЛЬКО если живого значения ещё нет: индекс
    // пересобирается на каждую смену схемы, и безусловная запись дефолта затирала бы
    // значение, уже пришедшее по WS, — ячейка навсегда оставалась бы с дефолтом, если
    // свойство больше не менялось.
    //
    // Теговые ячейки сидируем из уже известных значений сессии: при возврате на схему
    // они иначе пустые, хотя значение лежит в valuesRef. Неизвестного тега не касаемся —
    // до первого кадра элемент под оверлеем «нет данных».
    const propsByKey: Record<string, Record<string, unknown>> = {};
    for (const el of useEditorStore.getState().elements) {
      if (el.type !== "table") continue;
      for (const {cell} of cellBindings(el)) {
        if (!isLiveField(cell.field)) continue;
        const p = propertyByName(el, cell.propertyName);
        if (!p) continue;

        if (p.tag_id) {
          const live = valuesRef.current.get(p.tag_id);
          if (live == null) continue;
          (propsByKey[el.key] ??= {})[cellRuntimeKey(cell.row, cell.col)] = live;
          continue;
        }

        const value = valuesByPropNameRef.current.get(p.name) ?? String(p.default_value ?? "");
        valuesByPropNameRef.current.set(p.name, value);
        (propsByKey[el.key] ??= {})[cellRuntimeKey(cell.row, cell.col)] = value;
      }
    }

    // Счётчики ошибок и автоотключение живут ровно до пересборки индекса: биндинг,
    // отключённый после серии ошибок на прошлой схеме, обязан снова заработать на новой
    // (и на этой же после перезагрузки). Ошибки исполнения прошлой схемы убираем из
    // плашки «Проблемы с привязками» — тех биндингов на холсте больше нет.
    errorCountRef.current = new Map();
    disabledRef.current = new Set();
    const baseErrors: ReadonlyMap<string, string> = new Map();

    // Повторный прогон биндингов по УЖЕ ИЗВЕСТНЫМ значениям.
    //
    // Без него схема, открытая после того как значения пришли, остаётся в состоянии по
    // умолчанию навсегда: applyServerComponents обнуляет карту состояний, а flush
    // исполняет только биндинги ИЗМЕНИВШИХСЯ тегов — очередной кадр приносит то же
    // значение, страж no-op его отсекает, и биндинг не выполняется. Ровно этот путь
    // проходит оператор, применивший рецепт на одной схеме и перешедший на другую.
    const byKey = new Map(useEditorStore.getState().elements.map(el => [el.key, el] as const));
    const toRun = idx.all.filter(cb => hasKnownTrigger(cb, valuesRef.current, valuesByPropRef.current));
    const {stateNameByKey, propsByKey: nextProps, errors, fired} = runBindings(toRun, {
      valuesByTagId: valuesRef.current,
      valuesByPropertyId: valuesByPropRef.current,
      selfOf: key => {
        const el = byKey.get(key);
        return el ? getRenderedElement(el) : null;
      },
      errorCounts: errorCountRef.current,
      disabled: disabledRef.current,
      knownErrors: baseErrors,
    }, propsByKey);

    publishRuntimeErrors(errors);
    log(`повторный прогон при смене схемы: биндингов ${toRun.length} из ${idx.all.length}, сработало ${fired.length}`);

    // «Нет данных» (B4): тег, по которому ещё не было ни одного сообщения (tagMetaRef
    // пуст на самый первый маунт), считается недостоверным — элементы уходят в
    // noDataElementKeys, не дожидаясь первого BAD-кадра. При смене схемы внутри той же
    // сессии tagMetaRef уже знает часть тегов, и пересчёт это учитывает.
    //
    // Пишем БЕЗУСЛОВНО, без сравнения с прошлым набором: документ заменён целиком, и
    // ключи прошлой схемы обязаны уйти из стора, даже если сам набор «равен» по составу.
    const initialNoData = computeNoDataElementKeys(idx, tagMetaRef.current);
    noDataKeysRef.current = initialNoData;

    // Один батч на всё открытие схемы — один ре-рендер холста.
    useEditorStore.getState().applyRuntimeBatch({
      stateNameByKey,
      propsByKey: nextProps,
      noDataKeys: initialNoData,
    });
    // publishRuntimeErrors стабилен (useCallback без зависимостей) — в списке он ради
    // правила exhaustive-deps, пересчёт схемы им не запускается.
  }, [active, index, publishRuntimeErrors]);

  // Мост к серверному Java-скрипту: находим скрипт компонента по имени и шлём ACTION
  // по WS. sendAction ждёт ЧИСЛОВОЙ серверный id — ElementScript.id это String(серверный
  // id) после loadScene (см. transformElements); если id не число (напр. uuid у ещё не
  // сохранённого скрипта), команду не шлём.
  //
  // Вынесено из runEvent: тем же путём идут и пункты меню монитора (скрипты с
  // displayed), у которых события-повода нет.
  const runScriptOn = useCallback((el: DiagramElement, name: string) => {
    const script = el.scripts?.find(s => s.name === name);
    if (!script) {
      console.warn(`[monitor:event] runScript: скрипт «${name}» не найден у «${el.label ?? el.key}»`);
      return;
    }
    const scriptId = Number(script.id);
    if (!Number.isFinite(scriptId)) {
      console.warn(`[monitor:event] runScript: у скрипта «${name}» нет числового серверного id (${script.id})`);
      return;
    }
    connRef.current?.sendAction(scriptId);
  }, []);

  // Пункт меню монитора: запуск скрипта по ключу элемента и имени скрипта.
  const runScriptByKey = useCallback((elementKey: string, scriptName: string) => {
    const el = useEditorStore.getState().elements.find(e => e.key === elementKey);
    if (!el) return;
    runScriptOn(el, scriptName);
  }, [runScriptOn]);

  // Обработчик кликов по фигурам в мониторе (из слоя интеракции Canvas):
  // компилирует и исполняет element.events[event], пишет свойства в общий буфер
  // и применяет self-интенты. Использует стабильные ref-ы — deps пустые.
  const runEvent = useCallback((elementKey: string, event: ElementEventName) => {
    const store = useEditorStore.getState();
    const el = store.elements.find(e => e.key === elementKey);
    const handler = el?.events?.find(e => e.event_type === event)?.handler;
    if (!el || !handler || !handler.code?.trim()) return;

    const scope = withPropertyRefs(collectTagScope(el.properties), handler.propertyRefs);
    const compiled = compileEventScript(el.key, handler, scope);
    if ("error" in compiled) {
      console.warn(`[monitor:event] ${event} «${el.label ?? el.key}» не скомпилирован: ${compiled.error}`);
      return;
    }
    // onClick вызывает runScript("Имя") — тот же мост, что и у пунктов меню монитора.
    const runScript = (name: string) => runScriptOn(el, name);

    const res = executeEventScript(compiled, valuesRef.current, valuesByPropRef.current, getRenderedElement(el), runScript);
    if ("error" in res) {
      console.warn(`[monitor:event] ${event} ошибка исполнения: ${res.error}`);
      return;
    }

    // Записи свойств → тот же буфер, что и WS properties[]: на них реагируют
    // биндинги других элементов. НЕ трогаем valuesByPropRef здесь: flush сравнивает
    // pending со «старым» valuesByPropRef, чтобы понять, что значение изменилось —
    // предварительная запись сделала бы изменение «no-op», и биндинги бы не сработали.
    // flush (вызывается синхронно ниже) сам обновит valuesByPropRef для следующего клика.
    for (const w of res.writes) {
      pendingPropsRef.current.set(w.propertyId, w.value);
    }

    // Интенты setProp/setState — на сам элемент, применяем немедленно.
    if (res.intents.length) {
      const stateNameByKey: Record<string, string> = {};
      const propsByKey: Record<string, Record<string, unknown>> = {};
      for (const intent of res.intents) {
        if (intent.kind === "state") stateNameByKey[el.key] = intent.stateName;
        else (propsByKey[el.key] ??= {})[intent.key] = intent.value;
      }
      store.applyRuntimeBatch({stateNameByKey, propsByKey});
    }

    log(`событие ${event} по «${el.label ?? el.key}»: записей ${res.writes.length}, интентов ${res.intents.length}`);
    if (res.writes.length) flushRef.current();
  }, [runScriptOn]);

  /**
   * Значения, записанные оператором в ПЛК («Опции»), вливаются в общий поток ОДИН раз.
   *
   * Немедленно, а не со следующим кадром: иначе записанное появилось бы на схеме, только
   * когда (и если) по тегу придёт очередное сообщение — у редко меняющихся тегов это
   * минуты. Кладём в тот же буфер, что и телеметрия, и синхронно зовём flush — приём из
   * runEvent. Предзаписывать valuesRef НЕЛЬЗЯ: no-op-страж во flush счёл бы изменение
   * отсутствующим и ни одна привязка не сработала бы.
   *
   * Приоритета у записанного значения нет — первый же кадр по этому тегу его вытеснит.
   * Тег после записи волен меняться скриптом, другим оператором или самим контроллером.
   */
  const onTagsWritten = useCallback((writes: {tagId: string; value: string}[]) => {
    for (const {tagId, value} of writes) {
      pendingRef.current.set(tagId, value);
      // Тег, по которому кадров ещё не было, после подтверждённой записи перестаёт
      // считаться «нет данных» — иначе оверлей лёг бы поверх того, что оператор сам и
      // записал. Уже известное качество не трогаем: замазывать чужой BAD своей записью
      // нельзя, недостоверность тега от неё не исчезает.
      if (!tagMetaRef.current.has(tagId)) {
        tagMetaRef.current.set(tagId, {quality: "GOOD", ts: Date.now()});
        qualityDirtyRef.current = true;
      }
    }
    flushRef.current();
  }, []);

  // Регистрируем обработчики в шине, пока движок активен: события (клик по фигуре),
  // прямой запуск скрипта (пункт меню монитора), чтение текущих значений тегов и
  // уведомление о записи значений в ПЛК.
  useEffect(() => {
    if (!active) return;
    setRuntimeEventHandler(runEvent);
    setRuntimeScriptHandler(runScriptByKey);
    // Значения тегов держит движок, а не стор — окно «Опции» читает их геттером.
    setRuntimeValueGetter(tagId => valuesRef.current.get(tagId));
    setRuntimeTagWriteHandler(onTagsWritten);
    setRuntimeSessionGetter(() => connRef.current?.getSessionId() ?? null);
    return () => {
      setRuntimeEventHandler(null);
      setRuntimeScriptHandler(null);
      setRuntimeValueGetter(null);
      setRuntimeTagWriteHandler(null);
      setRuntimeSessionGetter(null);
    };
  }, [active, runEvent, runScriptByKey, onTagsWritten]);

  // Признак «связь есть» для интерфейса вне движка (пункты меню монитора).
  useEffect(() => {
    setRuntimeLive(status === "live");
    return () => setRuntimeLive(false);
  }, [status]);

  // Соединение живёт на пару (active, projectId) — смена сцены внутри проекта
  // его не пересоздаёт (индекс подменяется через ref).
  useEffect(() => {
    if (!active || projectId == null) return;

    log(`движок запущен для проекта ${projectId}`);
    lastMessageAtRef.current = 0;

    const conn = openRuntimeConnection(projectId, {
      onUpdate: (tags, properties) => {
        if (tags.length || properties.length) lastMessageAtRef.current = Date.now();
        // Несколько апдейтов одного тега в батче: Map даёт last-write-wins.
        for (const t of tags) {
          pendingRef.current.set(t.tagId, t.value);
          // quality отсутствует у сегодняшнего бэкенда — трактуем как GOOD (совместимость).
          const quality = t.quality ?? "GOOD";
          const prevMeta = tagMetaRef.current.get(t.tagId);
          if (!prevMeta || prevMeta.quality !== quality) qualityDirtyRef.current = true;
          tagMetaRef.current.set(t.tagId, {quality, ts: t.ts});
        }
        // properties[] — записи серверных Java-скриптов в свойства компонентов;
        // маршрутизируются по propertyId (значение → строка, toScopeValue распарсит).
        // Плюс по propertyName — отдельный путь для live-ячеек строк таблиц:
        // propertyId нестабилен между пересохранениями таблицы, а имя — нет.
        for (const p of properties) {
          pendingPropsRef.current.set(p.propertyId, String(p.value));
          if (p.propertyName) pendingPropNameRef.current.set(p.propertyName, String(p.value));
        }
      },
      onStatus: (s, detail) => {
        log(`статус соединения: ${s}${detail ? ` (${detail})` : ""}`);
        setStatus(s);
        setRejectionReason(s === "rejected" ? (detail ?? "") : null);
        setSessionId(connRef.current?.getSessionId() ?? null);
      },
    });
    connRef.current = conn;

    // Именно interval, а не rAF: rAF замерзает в фоновой вкладке, значения
    // копились бы без применения. Плюс мгновенный догон при возврате на вкладку.
    const timer = setInterval(() => flushRef.current(), FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) flushRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Отдельный редкий тик — не завязан на FLUSH_INTERVAL_MS, чтобы не пересчитывать
    // устаревание на каждый батч-рендер.
    const staleTimer = setInterval(() => {
      const stale = statusRef.current === "live"
        && lastMessageAtRef.current > 0
        && Date.now() - lastMessageAtRef.current > STALE_THRESHOLD_MS;
      setIsStale(prev => (prev === stale ? prev : stale));
    }, 1000);

    return () => {
      log(`движок остановлен для проекта ${projectId}, рантайм-карты очищены`);
      clearInterval(timer);
      clearInterval(staleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      conn.close();
      connRef.current = null;
      pendingRef.current = new Map();
      valuesRef.current = new Map();
      // Теневой буфер живых значений тоже принадлежит сессии: без сброса «снять подмену»
      // после переподключения вернуло бы значение из прошлой сессии.
      pendingPropsRef.current = new Map();
      valuesByPropRef.current = new Map();
      pendingPropNameRef.current = new Map();
      valuesByPropNameRef.current = new Map();
      errorCountRef.current = new Map();
      disabledRef.current = new Set();
      tagMetaRef.current = new Map();
      qualityDirtyRef.current = false;
      noDataKeysRef.current = new Set();
      useEditorStore.getState().clearRuntime();
      setSessionId(null);
      setRejectionReason(null);
      setIsStale(false);
    };
  }, [active, projectId]);

  return {
    status,
    compileErrors: index?.compileErrors ?? new Map(),
    runtimeErrors,
    sessionId,
    rejectionReason,
    isStale,
  };
}
