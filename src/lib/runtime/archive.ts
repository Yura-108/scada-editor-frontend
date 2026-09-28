/**
 * Клиент архива тегов (контракт docs/contract/2026-09-28-tag-archive-contract.md, раздел 3).
 *
 * Архив хранит только ИЗМЕНЕНИЯ: между точками значение стоит, поэтому тренд рисуется
 * ступенькой. Время внутри фронта — миллисекунды эпохи (как `ts` кадров WS), ISO-строки
 * живут только на границе с бэкендом.
 */

/** Запрос бэкенда принимает не больше 20 тегов (`runtime.archive.max-tags-per-request`). */
const TAGS_PER_REQUEST = 20;
/** Глубина архива. `from` старше — 400, поэтому зажимаем заранее (с запасом на часы). */
export const ARCHIVE_DEPTH_MS = 30 * 24 * 3600_000 - 60_000;
export const MAX_POINTS_LIMIT = 5000;

/** Точка тренда. `value: null` — разрыв (недостоверное значение, обрыв связи). */
export interface TrendPoint {
  ts: number;
  value: number | null;
}

export interface ArchiveSeries {
  tag: string;
  /** Значение на момент `from` — с него линия начинается у левого края; null — его нет. */
  initial: TrendPoint | null;
  points: TrendPoint[];
  /** Числовой тег прорежен до min/max по корзинам. */
  aggregated: boolean;
}

type RawPoint = {ts: string; value: unknown; good: boolean};
type RawSeries = {tag: string; initial: RawPoint | null; points: RawPoint[]; aggregated?: boolean};

/**
 * Значение тега → число для тренда.
 *
 * `bool` архив отдаёт как 1.0/0.0, а WS — строкой, отсюда `"true"/"false"`. Недостоверное
 * значение — `null` (разрыв линии). `undefined` — строка, которую не нарисовать: такую
 * точку пропускаем, линия продолжает стоять на прошлом значении.
 */
export function toTrendValue(raw: unknown, good = true): number | null | undefined {
  if (!good || raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s === "true") return 1;
    if (s === "false") return 0;
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const toPoint = (p: RawPoint | null | undefined): TrendPoint | null => {
  if (!p) return null;
  const ts = Date.parse(p.ts);
  const value = toTrendValue(p.value, p.good);
  if (Number.isNaN(ts) || value === undefined) return null;
  return {ts, value};
};

async function fetchChunk(
  tags: string[], from: number, to: number, maxPoints: number, signal?: AbortSignal,
): Promise<ArchiveSeries[]> {
  const q = new URLSearchParams();
  for (const t of tags) q.append("tag", t);
  q.set("from", new Date(from).toISOString());
  q.set("to", new Date(to).toISOString());
  q.set("maxPoints", String(maxPoints));

  const res = await fetch(`/api/runtime/archive/values?${q}`, {signal});
  if (!res.ok) {
    const body = await res.json().catch(() => null) as {message?: string; error?: string} | null;
    throw new Error(body?.message || body?.error || `Архив недоступен (${res.status})`);
  }
  const data = await res.json() as {series?: RawSeries[]};
  return (data.series ?? []).map(s => ({
    tag: s.tag,
    initial: toPoint(s.initial),
    points: (s.points ?? []).map(toPoint).filter((p): p is TrendPoint => p !== null),
    aggregated: !!s.aggregated,
  }));
}

/**
 * История тегов за `[from, to]` (мс). Тегов больше 20 — несколько запросов параллельно.
 * `from` зажимается к глубине архива: старше бэкенд отвечает 400 на весь запрос.
 */
export async function fetchArchiveValues(
  tags: string[],
  from: number,
  to: number,
  opts: {maxPoints?: number; signal?: AbortSignal} = {},
): Promise<Map<string, ArchiveSeries>> {
  const unique = [...new Set(tags.filter(Boolean))];
  const result = new Map<string, ArchiveSeries>();
  if (!unique.length) return result;

  const clampedFrom = Math.max(from, Date.now() - ARCHIVE_DEPTH_MS);
  if (clampedFrom >= to) return result;
  const maxPoints = Math.max(1, Math.min(MAX_POINTS_LIMIT, Math.round(opts.maxPoints ?? 1000)));

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += TAGS_PER_REQUEST) chunks.push(unique.slice(i, i + TAGS_PER_REQUEST));

  const parts = await Promise.all(chunks.map(c => fetchChunk(c, clampedFrom, to, maxPoints, opts.signal)));
  for (const part of parts) for (const s of part) result.set(s.tag, s);
  return result;
}

// ── Воспроизведение сцены (раздел 4) ─────────────────────────────────────────────

/** Значение тега из архива, как оно лежит в ответе: число (bool — 1/0), строка или null. */
export type ArchiveRawValue = number | string | null;

/** Изменение тега в ленте воспроизведения. `ts` — мс эпохи. */
export interface ReplayChange {
  ts: number;
  tag: string;
  value: ArchiveRawValue;
  good: boolean;
}

export interface ReplayPage {
  /** Состояние тегов на `from`; только у первой страницы (`after: null`), иначе null. */
  initial: Map<string, ReplayChange | null> | null;
  changes: ReplayChange[];
  /** Курсор следующей страницы; null — период выдан до конца. */
  next: string | null;
}

type RawReplayValue = {ts: string; value: unknown; good: boolean};

const rawValueOf = (v: unknown): ArchiveRawValue =>
  typeof v === "number" || typeof v === "string" ? v : typeof v === "boolean" ? (v ? 1 : 0) : null;

/** Одна страница ленты воспроизведения. */
export async function fetchReplayPage(args: {
  tags: string[];
  from: number;
  to: number;
  after: string | null;
  signal?: AbortSignal;
}): Promise<ReplayPage> {
  const res = await fetch("/api/runtime/archive/replay", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      tags: args.tags,
      from: new Date(args.from).toISOString(),
      to: new Date(args.to).toISOString(),
      after: args.after,
    }),
    signal: args.signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as {message?: string; error?: string} | null;
    throw new Error(body?.message || body?.error || `Архив недоступен (${res.status})`);
  }
  const data = await res.json() as {
    initial?: Record<string, RawReplayValue | null> | null;
    changes?: {ts: string; tag: string; value: unknown; good: boolean}[];
    next?: string | null;
  };

  let initial: Map<string, ReplayChange | null> | null = null;
  if (data.initial) {
    initial = new Map();
    for (const [tag, v] of Object.entries(data.initial)) {
      const ts = v ? Date.parse(v.ts) : NaN;
      initial.set(tag, v && !Number.isNaN(ts) ? {ts, tag, value: rawValueOf(v.value), good: !!v.good} : null);
    }
  }
  const changes: ReplayChange[] = [];
  for (const c of data.changes ?? []) {
    const ts = Date.parse(c.ts);
    if (Number.isNaN(ts)) continue;
    changes.push({ts, tag: c.tag, value: rawValueOf(c.value), good: !!c.good});
  }
  return {initial, changes, next: data.next ?? null};
}

/**
 * Значение архива → вид, в котором тот же тег приходит по WS.
 *
 * WS отдаёт исходную строку шлюза (`TagUpdate.value`), и дискретный тег там `"true"`/`"false"`.
 * Архив же хранит `Boolean` числом 1.0/0.0 (`ArchiveRecorder.toPoint`), и по самой точке bool от
 * числа не отличить — это знает только вызывающий (`isBool`). Без обратного приведения биндинг
 * `V == "true"` в архиве молча стал бы ложью, и схема показала бы не то состояние.
 */
export function archiveValueToWire(value: ArchiveRawValue, good: boolean, isBool: boolean): string | null {
  if (!good || value === null) return null;
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) return null;
  return isBool ? (value !== 0 ? "true" : "false") : String(value);
}
