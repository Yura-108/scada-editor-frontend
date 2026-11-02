import {useCallback, useEffect, useRef} from "react";
import {getSceneView, trendPens, trendTiming} from "@/core/scene";
import {mergeTrendHistory, setTrendWatch, useTrendStore} from "@/core/canvas";
import {getOpenScene} from "@/core/project";
import {fetchArchiveValues} from "../archive/archive";
import type {BindingIndex} from "./bindingIndex";
import type {RuntimeMode} from "./useRuntimeEngine";

/** Загрузка истории трендов; `trendHistoryAbortRef` — текущий запрос (его обрывает выход из архива). */
export function useTrendHistoryLoader() {
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
    // Проект — из стора, а не из замыкания: колбэк общий для эффектов и не должен пересоздаваться.
    const projectId = getOpenScene().currentProject?.id;
    if (projectId == null) return controller;
    fetchArchiveValues([...watched], at - retentionMs, at, {projectId, signal: controller.signal})
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

  return {loadTrendHistory, trendHistoryAbortRef};
}

interface WatchParams {
  active: boolean;
  index: BindingIndex | null;
  mode: RuntimeMode;
  loadTrendHistory: (at: number) => AbortController;
}

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
export function useTrendWatch({active, index, mode, loadTrendHistory}: WatchParams) {
  useEffect(() => {
    if (!active || !index) return;
    const tags = new Set<string>();
    let windowSec = 0;
    for (const el of getSceneView().elements) {
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
}
