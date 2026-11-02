import {useCallback, useEffect, useMemo, useRef, type Dispatch, type RefObject, type SetStateAction} from "react";
import {devLog} from "@/shared/lib/devLog";
import {getSceneView, isBooleanValueType, type DiagramElement} from "@/core/scene";
import {clearTrendSeries, setTrendClock, useTrendStore} from "@/core/canvas";
import {ingestTags, resetArchiveBuffers, type EngineBuffers} from "./engineBuffers";
import {isWireBoolTag, pushTrendPoints} from "./trendFeed";
import type {RuntimeStatus} from "./runtimeConnection";
import type {RuntimeMode} from "./useRuntimeEngine";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

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
  /** Проект монитора: ленту архива runtime проверяет по его prod-выпуску. */
  projectId: number | null;
}

interface ModeParams {
  active: boolean;
  mode: RuntimeMode;
  setStatus: Dispatch<SetStateAction<RuntimeStatus>>;
  setStatusDetail: Dispatch<SetStateAction<string | null>>;
  trendHistoryAbortRef: RefObject<AbortController | null>;
  resetSessionState: () => void;
}

/**
 * Режим «Архив»: WS не подключается, значения подаёт плеер через `archive.apply`. Здесь —
 * только вход и выход: статус «нет соединения» (закрытое соединение его не всегда
 * присылает) и сброс всего проигранного при выходе.
 */
export function useArchiveMode({active, mode, setStatus, setStatusDetail, trendHistoryAbortRef, resetSessionState}: ModeParams) {
  useEffect(() => {
    if (!active || mode !== "archive") return;
    log("режим архива: живое соединение не открывается");
    setStatus("closed");
    setStatusDetail(null);
    return () => {
      // Обрываем запрос, идущий В МОМЕНТ выхода, а не тот, что шёл при входе: перемотка
      // за время архива запускала новые.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      trendHistoryAbortRef.current?.abort();
      resetSessionState();
    };
  }, [active, mode, resetSessionState, setStatus, setStatusDetail, trendHistoryAbortRef]);
}

interface InputParams {
  elements: DiagramElement[];
  buffers: EngineBuffers;
  flushRef: RefObject<() => void>;
  loadTrendHistory: (at: number) => AbortController;
  sceneTags: string[];
  projectId: number | null;
}

/** Вход движка для плеера архива: дискретные теги, сброс на момент и применение изменений. */
export function useArchiveInput({elements, buffers, flushRef, loadTrendHistory, sceneTags, projectId}: InputParams) {
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
    (tag: string) => isWireBoolTag(tag) || boolPropertyTagsRef.current.has(tag),
    [],
  );

  const archiveReset = useCallback((at: number) => {
    resetArchiveBuffers(buffers);
    getSceneView().clearRuntime();

    clearTrendSeries();
    setTrendClock(at);
    if (useTrendStore.getState().watched.size) loadTrendHistory(at);
  }, [loadTrendHistory, buffers]);

  /**
   * Изменения из архива — тем же путём, что кадр WS: значения в pendingRef, качество в
   * tagMetaRef, точки трендов мимо flush, затем синхронный flush. Суточная опорная точка с тем
   * же значением отсекается no-op-стражем flush и ничего не перерисовывает.
   */
  const archiveApply = useCallback((changes: readonly ArchiveTagChange[]) => {
    const frames = changes.map(c => ({
      tagId: c.tag, value: c.value, ts: c.ts, quality: c.good ? "GOOD" : "BAD",
    }));
    ingestTags(buffers, frames);
    pushTrendPoints(frames);
    flushRef.current();
  }, [buffers, flushRef]);

  const archive = useMemo<RuntimeArchiveInput>(
    () => ({reset: archiveReset, apply: archiveApply, sceneTags, isBoolTag, projectId}),
    [archiveReset, archiveApply, sceneTags, isBoolTag, projectId],
  );

  return archive;
}
