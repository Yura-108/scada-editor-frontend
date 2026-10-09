"use client";

import {devLog} from "@/lib/devLog";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {adoptProcedureStatuses, pushProcedureEvents} from "@/store/useProcedureStore";
import {pushTaskStatuses, resetTaskStatuses} from "@/store/useAutomationTasksStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {buildBindingIndex, type BindingIndex} from "@/lib/runtime/bindingIndex";
import type {CompiledBinding} from "@/lib/runtime/executeBinding";
import {hasKnownTrigger, runBindings} from "@/lib/runtime/runBindings";
import {collectTagScope, withPropertyRefs} from "@/lib/runtime/bindingScope";
import {compileEventScript, executeEventScript, type ActionArgs} from "@/lib/runtime/eventScript";
import {openSceneFromScript} from "@/lib/runtime/openSceneFromScript";
import {
  setRuntimeEventHandler,
  setRuntimeLive,
  setRuntimeScriptHandler,
  setRuntimeSessionGetter,
  setRuntimeTagWriteHandler,
  setRuntimeValueGetter,
  setRuntimePropertyValueGetter,
  setRuntimeTagQualityGetter,
  showRuntimeMenu,
  type ScreenPoint,
} from "@/lib/runtime/runtimeEventBus";
import {openRuntimeConnection, type RuntimeConnection, type RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import {useRuntimeTagInterest} from "@/lib/runtime/runtimeTagInterest";
import {cellRuntimeKey} from "@/lib/editor/tableCells";
import {fetchArchiveValues, toTrendValue} from "@/lib/runtime/archive";
import {isBooleanValueType} from "@/lib/editor/valueTypes";
import {trendPens, trendTiming} from "@/lib/editor/trendSettings";
import {
  appendTrendPoints, clearTrendSeries, isTrendWatched, mergeTrendHistory, normalizeTs, resetTrendStore,
  setTrendClock, setTrendWatch, useTrendStore,
} from "@/store/useTrendStore";
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

/**
 * Точки трендов из кадра WS. Идут МИМО pendingRef/flush — тот буфер коалесцирует значения
 * (last-write-wins и страж «то же значение»), а тренду нужна каждая смена со своим
 * временем: два изменения в одном такте флаша иначе слились бы в одно.
 */
const pushTrendPoints = (tags: readonly {tagId: string; value: string | null; ts?: number; quality?: string}[]) => {
  const now = Date.now();
  const points: {tag: string; ts: number; value: number | null}[] = [];
  for (const t of tags) {
    if (!isTrendWatched(t.tagId)) continue;
    const value = toTrendValue(t.value, isTagQualityGood(t.quality));
    if (value === undefined) continue;
    points.push({tag: t.tagId, ts: normalizeTs(t.ts, now), value});
  }
  appendTrendPoints(points);
};

/**
 * Теги, которые по WS приходили как `"true"`/`"false"`. Архив хранит bool числом 1/0, и
 * вернуть ему вид WS можно, только зная, что тег дискретный (см. archiveValueToWire).
 * Модульный — переживает переподключение и смену режима в пределах вкладки.
 */
const wireBoolTags = new Set<string>();
const rememberWireBools = (tags: readonly {tagId: string; value: string | null}[]) => {
  for (const t of tags) if (t.value === "true" || t.value === "false") wireBoolTags.add(t.tagId);
};

/** Изменение тега из архива — уже в виде WS (строка), с качеством и временем. */
export interface ArchiveTagChange {
  tag: string;
  value: string | null;
  good: boolean;
  ts: number;
}

/** Вход движка для воспроизведения архива (режим `archive`). */
export interface RuntimeArchiveInput {
  /** Начать с чистого листа на момент `at`: значения, состояния, серии трендов. */
  reset: (at: number) => void;
  /** Применить изменения одним тиком — тем же путём, что кадр WS. */
  apply: (changes: readonly ArchiveTagChange[]) => void;
  /** Все теги открытой схемы — их и просим у архива. */
  sceneTags: string[];
  /** Дискретный ли тег (для обратного приведения 1/0 → "true"/"false"). */
  isBoolTag: (tag: string) => boolean;
}

/** Источник значений: живой WS или воспроизведение архива. */
export type RuntimeMode = "live" | "archive";

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
  /**
   * Пояснение к текущему статусу, когда оно есть: причина отказа при `rejected`
   * (проект не в эксплуатации, не назначен экземпляру, `e.reason` кода 1003) и причина
   * паузы при `reconnecting` (недоступный экземпляр runtime).
   */
  statusDetail: string | null;
  /** true — соединение "live", но кадров нет дольше STALE_THRESHOLD_MS (см. useRuntimeEngine.ts). */
  isStale: boolean;
  /** Подписка соединения на статусы задач automation (переживает переподключение). */
  subscribeTasks: () => void;
  unsubscribeTasks: () => void;
  archive: RuntimeArchiveInput;
}

/**
 * Движок биндингов режима монитора: держит рантайм-сессию (raw WS через gateway),
 * коалесирует входящие значения тегов (last-write-wins на тег), тикает 5 Гц и
 * применяет интенты одним applyRuntimeBatch (один set() → один ре-рендер сцены,
 * сколько бы тегов ни изменилось). elements не мутируются — ни undo, ни автосейв
 * рантайм не видят.
 */
export function useRuntimeEngine(active: boolean, mode: RuntimeMode = "live"): RuntimeEngineState {
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
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
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

  // Все теги открытой схемы: их просит у архива воспроизведение, на них же подписывается
  // живой WS. Перья трендов входят через elementKeysByTagId — это тег-свойства.
  const sceneTags = useMemo(() => {
    if (!index) return [] as string[];
    const all = new Set<string>(index.tagIds);
    for (const map of [index.elementKeysByTagId, index.tableCellsByTagId, index.directTagsByTagId]) {
      for (const tag of map.keys()) all.add(tag);
    }
    return [...all].sort();
  }, [index]);
  const sceneId = useEditorStore(s => (s.scene?.id == null ? null : Number(s.scene.id)));
  const extraTags = useRuntimeTagInterest();

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
    // Пересчёт «нет данных» без значений — после сброса архива, когда у тегов ещё нет ни
    // одной точки: оверлей обязан лечь, даже если применять нечего.
    if (!idx || (!pending.size && !pendingProps.size && !pendingNames.size && !qualityDirtyRef.current)) return;
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

    // Прямые привязки «значение элемента ← тег» (прогресс-бар и т.п.): тем же путём,
    // что ячейки, — без исполнения кода, элементу не нужно собственных свойств.
    for (const {tagId, value} of changedTags) {
      for (const target of idx.directTagsByTagId.get(tagId) ?? []) {
        (tableRowProps[target.elementKey] ??= {})[target.target] = value;
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

  // Последняя подписка на сцену, о которой знает runtime; null — подписки нет, сервер шлёт
  // теги всего проекта (до первой подписки и после TREE_CHANGED).
  // `tags` — полный набор (схема + панели) для локального сравнения и сброса, `wire` — то, что
  // ушло в сокет.
  const lastSubRef = useRef<{sceneId: number; tags: ReadonlySet<string>; wire: string[]} | null>(null);

  /**
   * Подписка WS на открытую сцену (контракты 2026-10-08-ws-scene-subscription-contract.md и
   * 2026-10-09-ws-scene-subscription-tags-fix.md).
   *
   * В `tags` уходят ТОЛЬКО теги панелей вне сцены (runtimeTagInterest) за вычетом тегов схемы.
   * Теги сцены runtime находит сам — свойства и прямые привязки, в т.ч. примитивов `composition`.
   * Сессии одной сцены без `tags` делят один кадр UPDATE, сериализуемый один раз на всех; непустой
   * `tags` делает набор сессии уникальным, и кадр собирается для неё отдельно. Поэтому тег сцены,
   * замерший без `tags`, — ошибка индекса runtime, а не повод дописать его сюда.
   *
   * Локально же сравнение «изменилась ли подписка» и сброс значений идут по полному набору.
   *
   * Объявлен РАНЬШЕ повторного прогона при смене схемы: сброс значений обязан случиться до того,
   * как прогон прочитает valuesRef и посчитает «нет данных».
   */
  useEffect(() => {
    if (!active || mode !== "live" || sceneId == null || !Number.isFinite(sceneId)) return;
    const next = new Set<string>(sceneTags);
    for (const t of extraTags) next.add(t);
    const prev = lastSubRef.current;
    if (prev && prev.sceneId === sceneId && setsEqual(prev.tags, next)) return;

    // Тег, выпавший из подписки, больше не обновляется — его значение устареет, а схема с ним
    // уверенно показывала бы то, чего уже нет. Держим только теги, которые были в подписке И
    // остаются в ней: значение, пришедшее «вдогонку» после ухода со сцены, тоже устарело бы.
    // Новые теги ждут немедленного UPDATE от runtime (до него — оверлей «нет данных»), и flush
    // прогонит их биндинги: значения в valuesRef нет, no-op-страж изменение не отсечёт.
    const keep = (tag: string) => next.has(tag) && (!prev || prev.tags.has(tag));
    let dropped = 0;
    for (const map of [valuesRef.current, pendingRef.current, tagMetaRef.current]) {
      for (const tag of [...map.keys()]) {
        if (keep(tag)) continue;
        map.delete(tag);
        dropped++;
      }
    }
    if (dropped) qualityDirtyRef.current = true;

    const onScene = new Set(sceneTags);
    const wire = extraTags.filter(t => !onScene.has(t));
    lastSubRef.current = {sceneId, tags: next, wire};
    // До открытия соединения connRef пуст — подписку отправит эффект соединения.
    connRef.current?.subscribeScene(sceneId, wire);
    log(`подписка на сцену ${sceneId}: тегов схемы ${sceneTags.length}, вне схемы ${wire.length}, сброшено значений ${dropped}`);
  }, [active, mode, sceneId, sceneTags, extraTags]);

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

      // Прямые привязки к тегу: без сида схема, открытая после прихода значений,
      // осталась бы со значением по умолчанию — flush исполняет только ИЗМЕНИВШИЕСЯ теги.
      for (const b of el.bindings ?? []) {
        if (b.enabled === false || !b.direct || !b.tag) continue;
        const live = valuesRef.current.get(b.tag);
        if (live == null) continue;
        (propsByKey[el.key] ??= {})[b.directTarget || "value"] = live;
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
  // displayed), у которых события-повода нет, и пункты меню выбора `showMenu`.
  //
  // `args` уже проверены (normalizeActionArgs) — здесь только доставка.
  const runScriptOn = useCallback((el: DiagramElement, name: string, args?: ActionArgs) => {
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
    connRef.current?.sendAction(scriptId, args);
  }, []);

  // Пункт меню монитора: запуск скрипта по ключу элемента и имени скрипта.
  const runScriptByKey = useCallback((elementKey: string, scriptName: string, args?: ActionArgs) => {
    const el = useEditorStore.getState().elements.find(e => e.key === elementKey);
    if (!el) return;
    runScriptOn(el, scriptName, args);
  }, [runScriptOn]);

  // Обработчик кликов по фигурам в мониторе (из слоя интеракции Canvas):
  // компилирует и исполняет element.events[event], пишет свойства в общий буфер
  // и применяет self-интенты. Использует стабильные ref-ы — deps пустые.
  const runEvent = useCallback((elementKey: string, event: ElementEventName, point?: ScreenPoint) => {
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
    // onClick вызывает runScript("Имя", args?) — тот же мост, что и у пунктов меню монитора.
    const runScript = (name: string, args?: ActionArgs) => runScriptOn(el, name, args);

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

    // Переход — последним: записи setProperty уже ушли во flush выше, а смена схемы
    // заменит elements, и применять интенты было бы уже не к чему.
    if (res.openScene !== undefined) {
      void openSceneFromScript(res.openScene, el.label ?? el.key);
      // Меню выбора поверх схемы, которая сейчас сменится, было бы не к месту.
      if (res.menu) console.warn(`[monitor:event] ${event} «${el.label ?? el.key}»: openScene и showMenu сразу — меню не показано`);
      return;
    }
    // Меню выбора рисует холст: пункт подтверждается и уходит через emitRuntimeScript.
    // Без точки клика (не из слоя интеракции) показывать его негде.
    if (res.menu && point) showRuntimeMenu({elementKey: el.key, point, items: res.menu});
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
  //
  // В архиве — не регистрируем ничего: записи в ПЛК там невозможны по построению, и клик,
  // дошедший до скрипта, не должен ни запустить действие, ни поменять вид элемента.
  useEffect(() => {
    if (!active || mode !== "live") return;
    setRuntimeEventHandler(runEvent);
    setRuntimeScriptHandler(runScriptByKey);
    // Значения тегов держит движок, а не стор — окно «Опции» читает их геттером.
    setRuntimeValueGetter(tagId => valuesRef.current.get(tagId));
    // Инспектор объектов: значения локальных свойств и качество тегов — не только открытой
    // схемы. Свойства приходят по всему проекту; теги вне схемы — только те, что инспектор
    // зарегистрировал в runtimeTagInterest (иначе подписка на сцену их не присылает).
    setRuntimePropertyValueGetter(id => valuesByPropRef.current.get(id));
    setRuntimeTagQualityGetter(tagId => tagMetaRef.current.get(tagId)?.quality);
    setRuntimeTagWriteHandler(onTagsWritten);
    setRuntimeSessionGetter(() => connRef.current?.getSessionId() ?? null);
    return () => {
      setRuntimeEventHandler(null);
      setRuntimeScriptHandler(null);
      setRuntimeValueGetter(null);
      setRuntimePropertyValueGetter(null);
      setRuntimeTagQualityGetter(null);
      setRuntimeTagWriteHandler(null);
      setRuntimeSessionGetter(null);
    };
  }, [active, mode, runEvent, runScriptByKey, onTagsWritten]);

  // Признак «связь есть» для интерфейса вне движка (пункты меню монитора).
  useEffect(() => {
    setRuntimeLive(mode === "live" && status === "live");
    return () => setRuntimeLive(false);
  }, [mode, status]);

  /**
   * История трендов за самое широкое окно, кончающееся в `at` (сейчас или курсор архива).
   * Прошлый запрос обрывается: при перемотке его ответ лёг бы поверх нового ряда.
   */
  const trendHistoryAbortRef = useRef<AbortController | null>(null);
  const loadTrendHistory = useCallback((at: number): AbortController => {
    trendHistoryAbortRef.current?.abort();
    const controller = new AbortController();
    trendHistoryAbortRef.current = controller;
    const {watched, retentionMs} = useTrendStore.getState();
    fetchArchiveValues([...watched], at - retentionMs, at, {signal: controller.signal})
      .then(series => {
        if (!controller.signal.aborted) mergeTrendHistory(series, at);
      })
      .catch(e => {
        if (controller.signal.aborted) return;
        // Без истории тренд всё равно дописывается точками — не повод для тоста.
        console.warn("[monitor:trend] история не загружена:", e);
      });
    return controller;
  }, []);

  /**
   * Всё, что принадлежит сессии значений (WS или воспроизведения архива): буферы, качество,
   * счётчики ошибок, рантайм-карты стора и серии трендов. Общий сброс для выхода из обоих
   * режимов — чтобы в архив не протекли живые значения, а из архива в живой режим прошлое.
   */
  const resetSessionState = useCallback(() => {
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
    resetTrendStore();
  }, []);

  // Соединение живёт на пару (active, projectId) — смена сцены внутри проекта
  // его не пересоздаёт (индекс подменяется через ref).
  useEffect(() => {
    if (!active || projectId == null || mode !== "live") return;

    log(`движок запущен для проекта ${projectId}`);
    lastMessageAtRef.current = 0;
    // Статусы принадлежат проекту: задачи прошлого проекта в панели остаться не должны.
    resetTaskStatuses();

    const conn = openRuntimeConnection(projectId, {
      onTasks: pushTaskStatuses,
      /**
       * Выпуск, который крутит проект. Сменился (кадр TREE_CHANGED, либо prod переключили,
       * пока не было связи, — тогда другой номер приходит с новой сессией) — стор перечитывает
       * список и схему выпуска. Биндинги перезапустятся сами: смена `elements` пересобирает
       * индекс, а следом за TREE_CHANGED приходит SNAPSHOT.
       */
      onRelease: (versionNo, changed) => {
        const store = useEditorStore.getState();
        const shown = store.releaseVersionNo;
        // TREE_CHANGED снял подписку на сервере: дальше снова идут все теги, а новую
        // подписку эффект подписки пошлёт, когда схема выпуска перерисуется.
        if (changed) lastSubRef.current = null;
        if (changed ||(shown !== null && shown !== versionNo)) void store.reloadRelease(versionNo);
        else store.setReleaseVersionNo(versionNo);
      },
      /**
       * Снимок состояния проекта при подключении. Идёт тем же путём, что телеметрия и
       * запись оператором: значения в pendingRef, затем синхронный flush. Предзаписывать
       * valuesRef НЕЛЬЗЯ — no-op-страж во flush счёл бы изменение отсутствующим, и ни
       * одна привязка не сработала бы, то есть схема осталась бы в состоянии по умолчанию
       * поверх идущего процесса.
       */
      onSnapshot: (tags, properties, procedures) => {
        lastMessageAtRef.current = Date.now();
        for (const t of tags) {
          pendingRef.current.set(t.tagId, t.value);
          const quality = t.quality ?? "GOOD";
          const prevMeta = tagMetaRef.current.get(t.tagId);
          if (!prevMeta || prevMeta.quality !== quality) qualityDirtyRef.current = true;
          tagMetaRef.current.set(t.tagId, {quality, ts: t.ts});
        }
        for (const p of properties) {
          pendingPropsRef.current.set(p.propertyId, String(p.value));
          if (p.propertyName) pendingPropNameRef.current.set(p.propertyName, String(p.value));
        }
        // Список активных процедур проекта ПОЛНЫЙ: отсутствие наблюдаемой в нём означает
        // «не запущена», а не «нет данных».
        adoptProcedureStatuses(procedures);
        rememberWireBools(tags);
        pushTrendPoints(tags);
        flushRef.current();
      },
      onUpdate: (tags, properties, procedures) => {
        if (tags.length || properties.length) lastMessageAtRef.current = Date.now();

        // События процедуры НЕ кладём в pendingRef: тот буфер коалесцирует значения
        // (last-write-wins плюс guard «то же значение — пропустить»), и для событий это
        // неверно вдвойне — STEP_STARTED и STEP_COMPLETED с одинаковой нагрузкой
        // схлопнулись бы, WRITE_FAILED/STALLED потерялись бы вовсе, а задержка на такте
        // флаша сместила бы секундомер шага. Отдаём сразу.
        pushProcedureEvents(procedures);
        rememberWireBools(tags);
        pushTrendPoints(tags);
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
        // Пояснение хранится для любого статуса, а не только для отказа: у «Переподключение…»
        // оно называет недоступный экземпляр runtime. Нет пояснения — нет и старого текста.
        setStatusDetail(detail ?? null);
        setSessionId(connRef.current?.getSessionId() ?? null);
      },
    });
    connRef.current = conn;
    // Эффект подписки мог отработать раньше соединения (первый маунт, возврат из архива) —
    // соединение запомнит подписку и отправит её при открытии сокета.
    const sub = lastSubRef.current;
    if (sub) conn.subscribeScene(sub.sceneId, sub.wire);

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
      resetSessionState();
      setSessionId(null);
      setStatusDetail(null);
      setIsStale(false);
    };
  }, [active, projectId, mode, resetSessionState]);

  /**
   * Режим «Архив»: WS не подключается, значения подаёт плеер через `archive.apply`. Здесь —
   * только вход и выход: статус «нет соединения» (закрытое соединение его не всегда
   * присылает) и сброс всего проигранного при выходе.
   */
  useEffect(() => {
    if (!active || mode !== "archive") return;
    log("режим архива: живое соединение не открывается");
    setStatus("closed");
    setStatusDetail(null);
    return () => {
      trendHistoryAbortRef.current?.abort();
      resetSessionState();
    };
  }, [active, mode, resetSessionState]);

  /**
   * Тренды открытой схемы: набор тегов перьев и история за самое широкое окно.
   *
   * На смену `index` — как и повторный прогон биндингов: это единственная надёжная точка
   * «на холст лёг другой документ». Дальше тренды дописываются из кадров WS
   * (pushTrendPoints). История грузится одним запросом по всем перьям (пачки по 20 тегов
   * режет fetchArchiveValues); смена схемы обрывает запрос прошлой.
   */
  //
  // В архиве здесь только набор перьев: историю грузит `archive.reset` на момент курсора,
  // потому что после каждой перемотки она нужна заново.
  useEffect(() => {
    if (!active || !index) return;
    const tags = new Set<string>();
    let windowSec = 0;
    for (const el of useEditorStore.getState().elements) {
      if (el.type !== "trend") continue;
      const pens = trendPens(el);
      if (!pens.length) continue;
      for (const pen of pens) tags.add(pen.tag);
      windowSec = Math.max(windowSec, trendTiming(el.trend).window);
    }
    setTrendWatch(tags, windowSec * 1000);
    if (mode !== "live" || !tags.size) return;
    const controller = loadTrendHistory(Date.now());
    return () => controller.abort();
  }, [active, index, mode, loadTrendHistory]);

  // Дискретные теги схемы по типу свойства — на случай, если по WS тег в этой вкладке ещё
  // не приходил и его вид неизвестен.
  const boolPropertyTagsRef = useRef(new Set<string>());
  useEffect(() => {
    const set = new Set<string>();
    for (const el of elements) {
      for (const p of el.properties ?? []) {
        if (p.property_type === "Тег" && p.tag_id && isBooleanValueType(p.value_type ?? undefined)) set.add(p.tag_id);
      }
    }
    boolPropertyTagsRef.current = set;
  }, [elements]);

  const isBoolTag = useCallback(
    (tag: string) => wireBoolTags.has(tag) || boolPropertyTagsRef.current.has(tag),
    [],
  );

  const archiveReset = useCallback((at: number) => {
    pendingRef.current = new Map();
    valuesRef.current = new Map();
    tagMetaRef.current = new Map();
    // Ни у одного тега ещё нет точки — «нет данных» пересчитается на первом apply.
    qualityDirtyRef.current = true;
    noDataKeysRef.current = new Set();
    errorCountRef.current = new Map();
    disabledRef.current = new Set();
    useEditorStore.getState().clearRuntime();

    clearTrendSeries();
    setTrendClock(at);
    if (useTrendStore.getState().watched.size) loadTrendHistory(at);
  }, [loadTrendHistory]);

  /**
   * Изменения из архива — тем же путём, что кадр WS: значения в pendingRef, качество в
   * tagMetaRef, точки трендов мимо flush, затем синхронный flush. Суточная опорная точка с тем
   * же значением отсекается no-op-стражем flush и ничего не перерисовывает.
   */
  const archiveApply = useCallback((changes: readonly ArchiveTagChange[]) => {
    const frames = changes.map(c => ({
      tagId: c.tag, value: c.value, ts: c.ts, quality: c.good ? "GOOD" : "BAD",
    }));
    for (const f of frames) {
      pendingRef.current.set(f.tagId, f.value);
      const prevMeta = tagMetaRef.current.get(f.tagId);
      if (!prevMeta || prevMeta.quality !== f.quality) qualityDirtyRef.current = true;
      tagMetaRef.current.set(f.tagId, {quality: f.quality, ts: f.ts});
    }
    pushTrendPoints(frames);
    flushRef.current();
  }, []);

  const archive = useMemo<RuntimeArchiveInput>(
    () => ({reset: archiveReset, apply: archiveApply, sceneTags, isBoolTag}),
    [archiveReset, archiveApply, sceneTags, isBoolTag],
  );

  const subscribeTasks = useCallback(() => connRef.current?.subscribeTasks(), []);
  const unsubscribeTasks = useCallback(() => connRef.current?.unsubscribeTasks(), []);

  return {
    status,
    compileErrors: index?.compileErrors ?? new Map(),
    runtimeErrors,
    sessionId,
    statusDetail,
    isStale,
    subscribeTasks,
    unsubscribeTasks,
    archive,
  };
}
