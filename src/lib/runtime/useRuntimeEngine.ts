"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {buildBindingIndex} from "@/lib/runtime/bindingIndex";
import {executeBinding, type CompiledBinding} from "@/lib/runtime/executeBinding";
import {collectTagScope, withPropertyRefs} from "@/lib/runtime/bindingScope";
import {compileEventScript, executeEventScript} from "@/lib/runtime/eventScript";
import {setRuntimeEventHandler} from "@/lib/runtime/runtimeEventBus";
import {openRuntimeConnection, type RuntimeStatus} from "@/lib/runtime/runtimeConnection";
import type {ElementEventName} from "@/types/binding.types";

/** Тик применения батча: сервер и так батчит ~40мс, 5 Гц на рендер достаточно. */
const FLUSH_INTERVAL_MS = 200;
/** Столько ошибок исполнения ПОДРЯД отключают биндинг до перезагрузки сцены. */
const MAX_CONSECUTIVE_ERRORS = 5;

const log = (...args: unknown[]) => console.log("[monitor:engine]", ...args);

export interface RuntimeEngineState {
  status: RuntimeStatus;
  /** binding.id → ошибка компиляции (биндинг не участвует в рантайме). */
  compileErrors: Map<string, string>;
  /** binding.id → последняя ошибка исполнения (после 5 подряд — автоотключение). */
  runtimeErrors: Map<string, string>;
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

  // Компиляция один раз на identity elements (загрузка/пересохранение сцены).
  const index = useMemo(
    () => (active ? buildBindingIndex(elements) : null),
    [active, elements],
  );
  const indexRef = useRef(index);
  indexRef.current = index;

  // Коалесинг-буфер тика (tag_id → последнее значение) и последние известные
  // значения всех тегов скоупа (аргументы для исполнения биндингов).
  const pendingRef = useRef(new Map<string, string>());
  const valuesRef = useRef(new Map<string, string>());
  // Зеркальные буферы для свойств других компонентов (properties[] UPDATE),
  // ключ — propertyId.
  const pendingPropsRef = useRef(new Map<number, string>());
  const valuesByPropRef = useRef(new Map<number, string>());
  const errorCountRef = useRef(new Map<string, number>());
  const disabledRef = useRef(new Set<string>());

  const flush = useCallback(() => {
    const idx = indexRef.current;
    const pending = pendingRef.current;
    const pendingProps = pendingPropsRef.current;
    if (!idx || (!pending.size && !pendingProps.size)) return;
    pendingRef.current = new Map();
    pendingPropsRef.current = new Map();

    // Слой no-op №1: то же сырое значение — тег/свойство не считается изменившимся.
    const affected = new Set<CompiledBinding>();
    const changedTags: {tagId: string; value: string}[] = [];
    for (const [tagId, value] of pending) {
      if (valuesRef.current.get(tagId) === value) continue;
      valuesRef.current.set(tagId, value);
      changedTags.push({tagId, value});
      for (const cb of idx.byTagId.get(tagId) ?? []) affected.add(cb);
    }
    const changedProps: {propertyId: number; value: string}[] = [];
    for (const [propertyId, value] of pendingProps) {
      if (valuesByPropRef.current.get(propertyId) === value) continue;
      valuesByPropRef.current.set(propertyId, value);
      changedProps.push({propertyId, value});
      for (const cb of idx.byPropertyId.get(propertyId) ?? []) affected.add(cb);
    }
    if (!affected.size) return;

    const store = useEditorStore.getState();
    const byKey = new Map(store.elements.map(el => [el.key, el] as const));

    const stateNameByKey: Record<string, string> = {};
    const propsByKey: Record<string, Record<string, unknown>> = {};
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
      `[monitor:engine] тик: изменилось тегов ${changedTags.length}, свойств ${changedProps.length}, затронуто биндингов ${affected.size}, сработало ${fired.length}`,
    );
    if (changedTags.length) console.table(changedTags);
    if (changedProps.length) console.table(changedProps);
    if (fired.length) console.table(fired);
    console.groupEnd();

    if (Object.keys(stateNameByKey).length || Object.keys(propsByKey).length) {
      // Слои no-op №2/№3 (то же состояние/значение, пустой батч) — внутри
      // applyRuntimeBatch: без фактических изменений set() не вызывается.
      log("применяю батч:", {stateNameByKey, propsByKey});
      store.applyRuntimeBatch({stateNameByKey, propsByKey});
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
  }, [active, index]);

  // Обработчик кликов по фигурам в мониторе (из слоя интеракции Canvas):
  // компилирует и исполняет element.events[event], пишет свойства в общий буфер
  // и применяет self-интенты. Использует стабильные ref-ы — deps пустые.
  const runEvent = useCallback((elementKey: string, event: ElementEventName) => {
    const store = useEditorStore.getState();
    const el = store.elements.find(e => e.key === elementKey);
    const handler = el?.events?.[event];
    if (!el || !handler || handler.enabled === false || !handler.code?.trim()) return;

    const scope = withPropertyRefs(collectTagScope(el.properties), handler.propertyRefs);
    const compiled = compileEventScript(el.key, handler, scope);
    if ("error" in compiled) {
      console.warn(`[monitor:event] ${event} «${el.label ?? el.key}» не скомпилирован: ${compiled.error}`);
      return;
    }
    const res = executeEventScript(compiled, valuesRef.current, valuesByPropRef.current, getRenderedElement(el));
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

    const conn = openRuntimeConnection(projectId, {
      onUpdate: (tags, properties) => {
        // Несколько апдейтов одного тега в батче: Map даёт last-write-wins.
        for (const t of tags) pendingRef.current.set(t.tagId, t.value);
        // properties[] — записи серверных Java-скриптов в свойства компонентов;
        // маршрутизируются по propertyId (значение → строка, buildTagObject распарсит).
        for (const p of properties) pendingPropsRef.current.set(p.propertyId, String(p.value));
      },
      onStatus: (s) => {
        log(`статус соединения: ${s}`);
        setStatus(s);
      },
    });

    // Именно interval, а не rAF: rAF замерзает в фоновой вкладке, значения
    // копились бы без применения. Плюс мгновенный догон при возврате на вкладку.
    const timer = setInterval(() => flushRef.current(), FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) flushRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      log(`движок остановлен для проекта ${projectId}, рантайм-карты очищены`);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      conn.close();
      pendingRef.current = new Map();
      valuesRef.current = new Map();
      pendingPropsRef.current = new Map();
      valuesByPropRef.current = new Map();
      errorCountRef.current = new Map();
      disabledRef.current = new Set();
      useEditorStore.getState().clearRuntime();
    };
  }, [active, projectId]);

  return {
    status,
    compileErrors: index?.compileErrors ?? new Map(),
    runtimeErrors,
  };
}
