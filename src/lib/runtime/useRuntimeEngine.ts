"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {buildBindingIndex, type BindingIndex} from "@/lib/runtime/bindingIndex";
import {executeBinding, type CompiledBinding} from "@/lib/runtime/executeBinding";
import {collectTagScope, withPropertyRefs} from "@/lib/runtime/bindingScope";
import {compileEventScript, executeEventScript} from "@/lib/runtime/eventScript";
import {setRuntimeEventHandler} from "@/lib/runtime/runtimeEventBus";
import {openRuntimeConnection, type RuntimeConnection, type RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import {cellRuntimeKey} from "@/lib/editor/tableCells";
import type {ElementEventName} from "@/types/binding.types";

/** Колонка live-значения строки таблицы (конвенция: 0 — номер, 1 — имя, 2 — значение). */
const TABLE_ROW_VALUE_COL = 2;

/** Тик применения батча: сервер и так батчит ~40мс, 5 Гц на рендер достаточно. */
const FLUSH_INTERVAL_MS = 200;
/** Столько ошибок исполнения ПОДРЯД отключают биндинг до перезагрузки сцены. */
const MAX_CONSECUTIVE_ERRORS = 5;
/** Соединение "live", но кадров нет дольше этого — считаем данные устаревшими
 *  (обрыв Kafka-консьюмера на бэкенде не рвёт WS, ts — единственный признак). */
const STALE_THRESHOLD_MS = 10_000;

const log = (...args: unknown[]) => console.log("[monitor:engine]", ...args);

/** quality отсутствует или "GOOD" — достоверно; всё остальное — нет (не сравнивать на "BAD"). */
const isTagQualityGood = (quality?: string) => quality === undefined || quality === "GOOD";

const setsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every(k => b.has(k));

/**
 * Элементы, у которых хотя бы один тег-свойство сейчас недостоверен (quality != GOOD)
 * ИЛИ по нему ещё не было ни одного сообщения (холодный старт, TAG_CONTRACT_CHANGES.md B4).
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
  // Последнее известное качество/момент снятия по тегу (TAG_CONTRACT_CHANGES.md B1/B3).
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

    // Живые значения строк таблиц (тег- и локальные, маршрутизация по tag_id/имени,
    // НЕ через CompiledBinding — это не JS-биндинги, а прямая запись в ячейку 2).
    const tableRowProps: Record<string, Record<string, unknown>> = {};
    for (const {tagId, value} of changedTags) {
      for (const target of idx.tableRowsByTagId.get(tagId) ?? []) {
        (tableRowProps[target.elementKey] ??= {})[cellRuntimeKey(target.row, TABLE_ROW_VALUE_COL)] = value;
      }
    }
    for (const {name, value} of changedNames) {
      for (const target of idx.tableRowsByPropertyName.get(name) ?? []) {
        (tableRowProps[target.elementKey] ??= {})[cellRuntimeKey(target.row, TABLE_ROW_VALUE_COL)] = value;
      }
    }

    if (!affected.size && !Object.keys(tableRowProps).length && !noDataKeys) return;

    const store = useEditorStore.getState();
    const byKey = new Map(store.elements.map(el => [el.key, el] as const));

    const stateNameByKey: Record<string, string> = {};
    const propsByKey: Record<string, Record<string, unknown>> = {...tableRowProps};
    const fired: {binding: string; intents: string}[] = [];
    let newErrors: Map<string, string> | null = null;

    for (const cb of affected) {
      const bindingId = cb.binding.id;
      if (disabledRef.current.has(bindingId)) continue;

      const el = byKey.get(cb.elementKey);
      const self = el ? getRenderedElement(el) : null;

      const res = executeBinding(cb, valuesRef.current, valuesByPropRef.current, self);
      if ("error" in res) {
        const count = (errorCountRef.current.get(bindingId) ?? 0) + 1;
        errorCountRef.current.set(bindingId, count);
        newErrors = newErrors ?? new Map(runtimeErrors);
        newErrors.set(bindingId, res.error);
        console.warn(
          `[monitor:engine] биндинг «${cb.binding.name}» ошибка исполнения (${count}/${MAX_CONSECUTIVE_ERRORS}): ${res.error}`,
        );
        if (count >= MAX_CONSECUTIVE_ERRORS) {
          disabledRef.current.add(bindingId);
          console.warn(
            `[monitor:engine] биндинг «${cb.binding.name}» ОТКЛЮЧЁН после ${count} ошибок подряд`,
          );
        }
        continue;
      }

      errorCountRef.current.set(bindingId, 0);
      if (res.intents.length) {
        fired.push({
          binding: cb.binding.name,
          intents: res.intents
            .map(i => i.kind === "state" ? `setState("${i.stateName}")` : `setProp("${i.key}", ${JSON.stringify(i.value)})`)
            .join(", "),
        });
      }
      for (const intent of res.intents) {
        if (intent.kind === "state") {
          stateNameByKey[cb.elementKey] = intent.stateName;
        } else {
          (propsByKey[cb.elementKey] ??= {})[intent.key] = intent.value;
        }
      }
    }

    if (newErrors) setRuntimeErrors(newErrors);

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
  }, [runtimeErrors]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Сид значений свойств из default_value: клиентские события (setProperty) и
  // биндинги читают valuesByPropRef; без сида первое чтение свойства = null.
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

    // Сид ячеек локальных строк таблиц из default_value — до первого WS-апдейта
    // ячейка 2 не должна быть пустой (доку: «до первого изменения» показывается default_value).
    const propsByKey: Record<string, Record<string, unknown>> = {};
    for (const el of useEditorStore.getState().elements) {
      if (el.type !== "table") continue;
      for (const p of el.properties ?? []) {
        if (p.tag_id || typeof p.position !== "number") continue;
        const value = String(p.default_value ?? "");
        valuesByPropNameRef.current.set(p.name, value);
        (propsByKey[el.key] ??= {})[cellRuntimeKey(p.position, TABLE_ROW_VALUE_COL)] = value;
      }
    }
    // Начальный расчёт «нет данных» (B4): тег, по которому ещё не было ни одного
    // сообщения (tagMetaRef пуст на самый первый маунт), считается недостоверным —
    // элементы, привязанные к нему, сразу уходят в noDataElementKeys, не дожидаясь
    // первого BAD-кадра. При смене сцены внутри той же сессии tagMetaRef уже может
    // знать часть тегов — пересчёт учитывает и это.
    const initialNoData = computeNoDataElementKeys(idx, tagMetaRef.current);
    const noDataChanged = !setsEqual(initialNoData, noDataKeysRef.current);
    if (noDataChanged) noDataKeysRef.current = initialNoData;

    if (Object.keys(propsByKey).length || noDataChanged) {
      useEditorStore.getState().applyRuntimeBatch({
        propsByKey: Object.keys(propsByKey).length ? propsByKey : undefined,
        noDataKeys: noDataChanged ? initialNoData : undefined,
      });
    }
  }, [active, index]);

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
    // Мост к серверному Java-скрипту: onClick вызывает runScript("Имя") → находим
    // скрипт компонента по имени и шлём ACTION по WS. sendAction ждёт ЧИСЛОВОЙ
    // серверный id — ElementScript.id это String(серверный id) после loadScene
    // (см. transformElements); если id не число (напр. uuid), команду не шлём.
    const runScript = (name: string) => {
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
    };

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
  }, []);

  // Регистрируем обработчик событий в шине, пока движок активен.
  useEffect(() => {
    if (!active) return;
    setRuntimeEventHandler(runEvent);
    return () => setRuntimeEventHandler(null);
  }, [active, runEvent]);

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
        // маршрутизируются по propertyId (значение → строка, buildTagObject распарсит).
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
