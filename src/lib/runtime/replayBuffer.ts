import type {ReplayChange} from "@/lib/runtime/archive";

/**
 * Буфер ленты воспроизведения архива — чистые функции без React, чтобы логику плеера
 * можно было проверить отдельно.
 *
 * Лента приходит страницами (до 50 000 изменений, по возрастанию `ts`). Плеер применяет её
 * кусками «всё до курсора» и заранее подгружает следующую страницу, пока играет текущая.
 */
export interface ReplayBuffer {
  /** Ещё не применённые и применённые изменения текущей страницы (и дозагруженных). */
  changes: ReplayChange[];
  /** Сколько изменений с начала `changes` уже применено. */
  applied: number;
  /** Курсор следующей страницы; null — период выдан до конца. */
  next: string | null;
  /** Конец периода, мс. */
  periodTo: number;
}

/** Доля непроигранного остатка, при которой пора просить следующую страницу. */
const PREFETCH_REMAINDER = 0.2;

export const emptyBuffer = (periodTo: number): ReplayBuffer => ({changes: [], applied: 0, next: null, periodTo});

/**
 * До какого момента лента известна полностью. Пока есть следующая страница — строго раньше
 * последней загруженной точки: курсор бэкенда идёт по (ts, tag), и изменения с тем же `ts`
 * могут продолжиться на следующей странице.
 */
export function loadedUntil(b: ReplayBuffer): number {
  if (b.next === null) return b.periodTo;
  const last = b.changes[b.changes.length - 1];
  return last ? last.ts - 1 : -Infinity;
}

/** Изменения с `ts ≤ until`, ещё не применённые, и новый индекс применённого. */
export function takeUntil(b: ReplayBuffer, until: number): {batch: ReplayChange[]; applied: number} {
  let i = b.applied;
  while (i < b.changes.length && b.changes[i].ts <= until) i++;
  return {batch: b.changes.slice(b.applied, i), applied: i};
}

/** Пора ли подгружать следующую страницу. */
export function needsPrefetch(b: ReplayBuffer): boolean {
  if (b.next === null) return false;
  const remaining = b.changes.length - b.applied;
  return remaining <= Math.max(1, b.changes.length * PREFETCH_REMAINDER);
}

/** Дописать страницу; проигранное отбрасывается, чтобы буфер не рос весь период. */
export function appendPage(b: ReplayBuffer, changes: ReplayChange[], next: string | null): ReplayBuffer {
  return {...b, changes: b.changes.slice(b.applied).concat(changes), applied: 0, next};
}

/**
 * Куда может сдвинуться курсор за тик: не дальше конца периода и не дальше известной ленты —
 * иначе изменения из ещё не пришедшей страницы применились бы позже своего времени.
 * `buffering` — курсор упёрся в незагруженное.
 */
export function advanceCursor(b: ReplayBuffer, cursor: number, stepMs: number): {cursor: number; buffering: boolean} {
  const wanted = Math.min(cursor + stepMs, b.periodTo);
  const limit = loadedUntil(b);
  if (wanted <= limit) return {cursor: wanted, buffering: false};
  return {cursor: Math.max(cursor, limit), buffering: true};
}

/** Перемотка внутри уже загруженного: вперёд и не дальше известной ленты. */
export const canSeekInBuffer = (b: ReplayBuffer, cursor: number, target: number): boolean =>
  target >= cursor && target <= loadedUntil(b);
