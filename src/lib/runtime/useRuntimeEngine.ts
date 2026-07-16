"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {buildBindingIndex} from "@/lib/runtime/bindingIndex";
import {executeBinding, type CompiledBinding} from "@/lib/runtime/executeBinding";
import {openRuntimeConnection, type RuntimeStatus} from "@/lib/runtime/runtimeConnection";

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
  const errorCountRef = useRef(new Map<string, number>());
  const disabledRef = useRef(new Set<string>());

  const flush = useCallback(() => {
    const idx = indexRef.current;
    const pending = pendingRef.current;
    if (!idx || !pending.size) return;
    pendingRef.current = new Map();

    // Слой no-op №1: то же сырое значение — тег не считается изменившимся.
    const affected = new Set<CompiledBinding>();
    const changedTags: {tagId: string; value: string}[] = [];
    for (const [tagId, value] of pending) {
      if (valuesRef.current.get(tagId) === value) continue;
      valuesRef.current.set(tagId, value);
      changedTags.push({tagId, value});
      for (const cb of idx.byTagId.get(tagId) ?? []) affected.add(cb);
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

      const res = executeBinding(cb, valuesRef.current, self);
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
      `[monitor:engine] тик: изменилось тегов ${changedTags.length}, затронуто биндингов ${affected.size}, сработало ${fired.length}`,
    );
    console.table(changedTags);
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

  // Соединение живёт на пару (active, projectId) — смена сцены внутри проекта
  // его не пересоздаёт (индекс подменяется через ref).
  useEffect(() => {
    if (!active || projectId == null) return;

    log(`движок запущен для проекта ${projectId}`);

    const conn = openRuntimeConnection(projectId, {
      onUpdate: (tags, properties) => {
        // Несколько апдейтов одного тега в батче: Map даёт last-write-wins.
        for (const t of tags) pendingRef.current.set(t.tagId, t.value);
        // properties[] — записи серверных Java-скриптов; обработка — Phase B.
        if (properties.length) {
          log("properties[] из UPDATE (пока игнорируются, Phase B):", properties);
        }
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
