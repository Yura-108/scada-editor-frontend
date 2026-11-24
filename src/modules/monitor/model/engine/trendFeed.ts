import {appendTrendPoints, isTrendWatched, normalizeTs} from "@/core/canvas";
import {toTrendValue} from "../archive/archive";
import {isTagQualityGood} from "./engineBuffers";

type TrendFrameTag = {tagId: string; value: string | null; ts?: number; quality?: string};
type TrendPointUpdate = {tag: string; ts: number; value: number | null};

/**
 * Точки, принятые из кадров WS и ещё не отданные в стор трендов.
 *
 * Очередь, а не `buffers.pending`: тот буфер коалесцирует значения (last-write-wins и страж
 * «то же значение»), а тренду нужна каждая смена со своим временем — два изменения в одном
 * такте иначе слились бы в одно. Здесь точки лежат все, по порядку прихода.
 */
const queued: TrendPointUpdate[] = [];

/**
 * Точки трендов из кадра WS — в очередь до ближайшего такта (`flushTrendPoints`).
 *
 * Раньше каждая точка шла в стор сразу: копия ряда (до 50 000 точек) и перерисовка тренда —
 * а с ним всего слоя холста — на каждый кадр WS, то есть в несколько раз чаще такта, которым
 * обновляется остальная схема. Время точки берётся из кадра (или момента приёма), поэтому
 * задержка до такта на графике не видна: точка встаёт на своё место по оси времени.
 */
export const queueTrendPoints = (tags: readonly TrendFrameTag[]) => {
  const now = Date.now();
  for (const t of tags) {
    if (!isTrendWatched(t.tagId)) continue;
    const value = toTrendValue(t.value, isTagQualityGood(t.quality));
    if (value === undefined) continue;
    queued.push({tag: t.tagId, ts: normalizeTs(t.ts, now), value});
  }
};

/** Отдаёт накопленные точки в стор трендов одним `setState`. */
export const flushTrendPoints = () => {
  if (queued.length) appendTrendPoints(queued.splice(0));
};

/** Сессия закончилась: её точки новой сессии не принадлежат. */
export const dropQueuedTrendPoints = () => {
  queued.length = 0;
};

/**
 * Точки трендов сразу в стор — для снимка при подключении и ленты архива, где следом идёт
 * синхронный `flush`. Очередь отдаётся тем же вызовом, раньше новых точек: порядок прихода
 * сохраняется.
 */
export const pushTrendPoints = (tags: readonly TrendFrameTag[]) => {
  queueTrendPoints(tags);
  flushTrendPoints();
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
