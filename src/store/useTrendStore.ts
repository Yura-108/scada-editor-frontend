"use client";

import {create} from "zustand";
import type {ArchiveSeries, TrendPoint} from "@/lib/runtime/archive";

/**
 * Серии трендов монитора: история из архива + точки, дописанные из живого WS.
 *
 * Отдельный стор, а не рантайм-карты useEditorStore: точки — это ряд во времени, а не
 * «текущее значение», и их поток не должен перерисовывать всю схему — на серию
 * подписан только тренд, у которого есть перо с этим тегом.
 *
 * Ведём только теги из `watched` (перья трендов открытой схемы): писать ряд по каждому
 * тегу проекта значило бы копить память ни для кого.
 */

/** Предел точек на тег — страховка от тега, дребезжащего десятки раз в секунду. */
const MAX_POINTS_PER_TAG = 50_000;

interface TrendStore {
  seriesByTag: Record<string, TrendPoint[]>;
  /** Теги с прореженной историей (архив вернул `aggregated`). */
  aggregatedTags: Record<string, true>;
  watched: ReadonlySet<string>;
  /** Сколько истории держим, мс: самое широкое окно трендов схемы. */
  retentionMs: number;
  /**
   * «Сейчас» для трендов. null — реальные часы (живой монитор); число — курсор
   * воспроизведения архива: окно тренда стоит на нём, а не на текущем времени.
   */
  clockTs: number | null;
  /** Растёт на каждой очистке серий (перемотка архива): держателям своей истории — перезапросить. */
  generation: number;
}

export const useTrendStore = create<TrendStore>(() => ({
  seriesByTag: {},
  aggregatedTags: {},
  watched: new Set(),
  retentionMs: 0,
  clockTs: null,
  generation: 0,
}));

/** Текущее «сейчас» трендов: курсор архива или реальное время. */
const clockNow = () => useTrendStore.getState().clockTs ?? Date.now();

/** Курсор архива (null — вернуться к реальным часам). */
export function setTrendClock(clockTs: number | null) {
  if (useTrendStore.getState().clockTs !== clockTs) useTrendStore.setState({clockTs});
}

/** Серии — долой, набор перьев остаётся: перемотка архива начинает ряд заново. */
export function clearTrendSeries() {
  useTrendStore.setState(s => ({seriesByTag: {}, aggregatedTags: {}, generation: s.generation + 1}));
}

/**
 * `ts` кадра WS → миллисекунды. Единица в контракте сессий не зафиксирована, поэтому
 * принимаем и секунды, и мс, и ISO-строку; без `ts` — момент приёма.
 */
export function normalizeTs(raw: unknown, fallback = Date.now()): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw < 1e11 ? raw * 1000 : raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n < 1e11 ? n * 1000 : n;
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Обрезка слева: всё старше `cutoff`, кроме ОДНОЙ последней точки до него — с неё линия
 * начинается у левого края окна (значение стоит до следующего изменения).
 */
function trim(points: TrendPoint[], cutoff: number): TrendPoint[] {
  let i = 0;
  while (i + 1 < points.length && points[i + 1].ts <= cutoff) i++;
  const out = i > 0 ? points.slice(i) : points;
  return out.length > MAX_POINTS_PER_TAG ? out.slice(out.length - MAX_POINTS_PER_TAG) : out;
}

/** Набор тегов и глубина истории — по трендам открытой схемы. Чужие серии уходят. */
export function setTrendWatch(tags: Iterable<string>, retentionMs: number) {
  const watched = new Set(tags);
  const {seriesByTag, aggregatedTags} = useTrendStore.getState();
  const nextSeries: Record<string, TrendPoint[]> = {};
  const nextAggregated: Record<string, true> = {};
  for (const tag of watched) {
    if (seriesByTag[tag]) nextSeries[tag] = seriesByTag[tag];
    if (aggregatedTags[tag]) nextAggregated[tag] = true;
  }
  useTrendStore.setState({watched, retentionMs, seriesByTag: nextSeries, aggregatedTags: nextAggregated});
}

export const isTrendWatched = (tag: string) => useTrendStore.getState().watched.has(tag);

/** Живые точки из кадра WS — одним `setState` на кадр. */
export function appendTrendPoints(updates: {tag: string; ts: number; value: number | null}[]) {
  if (!updates.length) return;
  const {seriesByTag, watched, retentionMs} = useTrendStore.getState();
  const next = {...seriesByTag};
  let changed = false;
  const cutoff = clockNow() - retentionMs;
  const touched = new Set<string>();

  for (const u of updates) {
    if (!watched.has(u.tag)) continue;
    const prev = next[u.tag] ?? [];
    const last = prev[prev.length - 1];
    // Повтор того же значения ничего не рисует (снимок при подключении дублирует историю).
    if (last && last.value === u.value) continue;
    // Точка «из прошлого» (часы источника отстают) не должна ломать порядок ряда.
    const ts = last && u.ts < last.ts ? last.ts : u.ts;
    next[u.tag] = touched.has(u.tag) ? prev : [...prev];
    next[u.tag].push({ts, value: u.value});
    touched.add(u.tag);
    changed = true;
  }
  if (!changed) return;
  for (const tag of touched) next[tag] = trim(next[tag], cutoff);
  useTrendStore.setState({seriesByTag: next});
}

/**
 * История из архива за `[.., to]`. Живые точки, пришедшие ПОСЛЕ `to` (пока запрос шёл),
 * остаются в хвосте; более ранние заменяются архивом — он их тоже записал.
 */
export function mergeTrendHistory(series: Map<string, ArchiveSeries>, to: number) {
  const {seriesByTag, aggregatedTags, watched, retentionMs} = useTrendStore.getState();
  const next = {...seriesByTag};
  const nextAggregated = {...aggregatedTags};
  const cutoff = clockNow() - retentionMs;
  for (const [tag, s] of series) {
    if (!watched.has(tag)) continue;
    const history = s.initial ? [s.initial, ...s.points] : [...s.points];
    const lastHistoryTs = history.length ? history[history.length - 1].ts : -Infinity;
    const tail = (next[tag] ?? []).filter(p => p.ts > to && p.ts >= lastHistoryTs);
    next[tag] = trim([...history, ...tail], cutoff);
    if (s.aggregated) nextAggregated[tag] = true; else delete nextAggregated[tag];
  }
  useTrendStore.setState({seriesByTag: next, aggregatedTags: nextAggregated});
}

export function resetTrendStore() {
  useTrendStore.setState({seriesByTag: {}, aggregatedTags: {}, watched: new Set(), retentionMs: 0, clockTs: null});
}
