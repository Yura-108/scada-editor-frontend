import {appendTrendPoints, isTrendWatched, normalizeTs} from "@/core/canvas";
import {toTrendValue} from "../archive/archive";
import {isTagQualityGood} from "./engineBuffers";

/**
 * Точки трендов из кадра WS. Идут МИМО pendingRef/flush — тот буфер коалесцирует значения
 * (last-write-wins и страж «то же значение»), а тренду нужна каждая смена со своим
 * временем: два изменения в одном такте флаша иначе слились бы в одно.
 */
export const pushTrendPoints = (tags: readonly {tagId: string; value: string | null; ts?: number; quality?: string}[]) => {
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
/** Приходил ли тег по WS как `"true"`/`"false"`. */
export const isWireBoolTag = (tag: string) => wireBoolTags.has(tag);
export const rememberWireBools = (tags: readonly {tagId: string; value: string | null}[]) => {
  for (const t of tags) if (t.value === "true" || t.value === "false") wireBoolTags.add(t.tagId);
};
