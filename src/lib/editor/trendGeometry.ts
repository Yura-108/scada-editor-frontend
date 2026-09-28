import type {TrendPoint} from "@/lib/runtime/archive";
import type {TrendPen} from "@/lib/editor/trendSettings";

/**
 * Геометрия тренда — чистая функция, общая для холста (Konva) и окна тренда в мониторе (SVG).
 *
 * Архив хранит только изменения, поэтому линия — СТУПЕНЬКА: значение стоит до следующей
 * точки, затем вертикальный скачок. Наклонная линия между точками врала бы о значениях,
 * которых не было. `value: null` — разрыв (недостоверно, обрыв связи).
 */

export interface PlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PenGeometry {
  name: string;
  color: string;
  width: number;
  /** Непрерывные куски линии, плоские координаты `[x0, y0, x1, y1, …]`. */
  segments: number[][];
  /** Точки изменений внутри окна. */
  dots: {x: number; y: number}[];
  scale: {min: number; max: number};
  /** Последнее значение в окне (для легенды); null — нет данных или разрыв. */
  last: number | null;
}

export interface TrendGeometry {
  pens: PenGeometry[];
  xTicks: {x: number; label: string}[];
  /** Подписи Y — по шкале первого пера с данными (у каждого пера шкала своя). */
  yTicks: {y: number; label: string}[];
  yScaleColor: string | null;
}

const X_TICKS_MAX = 12;
const Y_TICKS = 4;

/** Точка, от которой линия стартует у левого края: последняя с `ts <= from`. */
function startIndex(points: TrendPoint[], from: number): number {
  // Двоичный поиск: серии живого окна бывают длинными, а считать их на каждый тик часов.
  let lo = 0;
  let hi = points.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].ts <= from) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/**
 * Прореживание по пикселям: в каждой колонке — первая, минимальная, максимальная и последняя
 * точки (в порядке времени) и любой разрыв. Пики сохраняются, как у `aggregated` архива.
 */
function decimate(points: TrendPoint[], from: number, to: number, columns: number): TrendPoint[] {
  if (points.length <= columns * 4) return points;
  const out: TrendPoint[] = [];
  const span = to - from || 1;
  let bucket: TrendPoint[] = [];
  let bucketIdx = -1;
  const flushBucket = () => {
    if (!bucket.length) return;
    const keep = new Set<TrendPoint>([bucket[0], bucket[bucket.length - 1]]);
    let min: TrendPoint | null = null;
    let max: TrendPoint | null = null;
    for (const p of bucket) {
      if (p.value === null) { keep.add(p); continue; }
      if (!min || p.value < (min.value as number)) min = p;
      if (!max || p.value > (max.value as number)) max = p;
    }
    if (min) keep.add(min);
    if (max) keep.add(max);
    for (const p of bucket) if (keep.has(p)) out.push(p);
    bucket = [];
  };
  for (const p of points) {
    const idx = Math.floor(((p.ts - from) / span) * columns);
    if (idx !== bucketIdx) { flushBucket(); bucketIdx = idx; }
    bucket.push(p);
  }
  flushBucket();
  return out;
}

function autoScale(values: number[]): {min: number; max: number} {
  if (!values.length) return {min: 0, max: 100};
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return {min: min - pad, max: max + pad};
  }
  const pad = (max - min) * 0.05;
  min -= pad;
  max += pad;
  return {min, max};
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatTrendTime(ts: number, withSeconds: boolean): string {
  const d = new Date(ts);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return withSeconds ? `${hm}:${pad2(d.getSeconds())}` : hm;
}

export function formatTrendValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000 || abs === 0) return String(Math.round(v));
  if (abs >= 10) return v.toFixed(1).replace(/\.0$/, "");
  return v.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Тики времени кратны `step` в МЕСТНОМ времени (часовой шаг встаёт на :00, а не на час UTC
 * со смещением пояса). Слишком частый шаг укрупняется кратно, чтобы подписи не слипались.
 */
function timeTicks(from: number, to: number, stepSec: number, plot: PlotRect): {x: number; label: string}[] {
  let step = Math.max(1, stepSec) * 1000;
  const span = to - from;
  if (span <= 0) return [];
  while (span / step > X_TICKS_MAX) step *= 2;
  const tz = new Date(from).getTimezoneOffset() * 60_000;
  const first = Math.ceil((from - tz) / step) * step + tz;
  const withSeconds = step < 60_000;
  const ticks: {x: number; label: string}[] = [];
  for (let t = first; t <= to; t += step) {
    ticks.push({x: plot.x + ((t - from) / span) * plot.w, label: formatTrendTime(t, withSeconds)});
  }
  return ticks;
}

export function buildTrendGeometry(args: {
  pens: TrendPen[];
  /** Серии по пути тега, по возрастанию `ts`; может включать точку до `from`. */
  seriesByTag: Readonly<Record<string, readonly TrendPoint[] | undefined>>;
  from: number;
  to: number;
  stepSec: number;
  plot: PlotRect;
  /** Масштаб, заданный оператором в окне тренда: перекрывает оформление пера. */
  scaleOverride?: Readonly<Record<string, {min?: number; max?: number}>>;
}): TrendGeometry {
  const {pens, seriesByTag, from, to, stepSec, plot, scaleOverride} = args;
  const span = to - from || 1;
  const xOf = (ts: number) => plot.x + ((Math.min(Math.max(ts, from), to) - from) / span) * plot.w;

  const geometries: PenGeometry[] = [];
  let yScale: {min: number; max: number} | null = null;
  let yScaleColor: string | null = null;

  for (const pen of pens) {
    const all = (seriesByTag[pen.tag] ?? []) as TrendPoint[];
    const si = startIndex(all, from);
    const startValue = si >= 0 ? all[si].value : undefined;
    let inRange = all.slice(si + 1).filter(p => p.ts <= to);
    inRange = decimate(inRange, from, to, Math.max(1, Math.round(plot.w)));

    const values: number[] = [];
    if (typeof startValue === "number") values.push(startValue);
    for (const p of inRange) if (p.value !== null) values.push(p.value);

    const auto = autoScale(values);
    const override = scaleOverride?.[pen.name] ?? {};
    const min = override.min ?? pen.min ?? auto.min;
    let max = override.max ?? pen.max ?? auto.max;
    if (max <= min) max = min + 1;
    const yOf = (v: number) => {
      const k = (v - min) / (max - min);
      return plot.y + plot.h - Math.min(1, Math.max(0, k)) * plot.h;
    };

    const segments: number[][] = [];
    const dots: {x: number; y: number}[] = [];
    let current: number[] | null = null;
    let value: number | null = typeof startValue === "number" ? startValue : null;
    if (value !== null) current = [plot.x, yOf(value)];

    for (const p of inRange) {
      const x = xOf(p.ts);
      if (current && value !== null) current.push(x, yOf(value));
      if (p.value === null) {
        if (current && current.length >= 4) segments.push(current);
        current = null;
      } else {
        const y = yOf(p.value);
        if (current) current.push(x, y); else current = [x, y];
        dots.push({x, y});
      }
      value = p.value;
    }
    if (current && value !== null) {
      current.push(plot.x + plot.w, yOf(value));
      if (current.length >= 4) segments.push(current);
    }

    geometries.push({
      name: pen.name, color: pen.color, width: pen.width,
      segments, dots, scale: {min, max}, last: value,
    });

    if (!yScale && values.length) {
      yScale = {min, max};
      yScaleColor = pen.color;
    }
  }

  // Ни у одного пера нет данных — подписи по первому перу (его шкала задана или 0…100).
  if (!yScale && geometries.length) {
    yScale = geometries[0].scale;
    yScaleColor = geometries[0].color;
  }

  const yTicks: {y: number; label: string}[] = [];
  if (yScale) {
    for (let i = 0; i <= Y_TICKS; i++) {
      const v = yScale.min + ((Y_TICKS - i) / Y_TICKS) * (yScale.max - yScale.min);
      yTicks.push({y: plot.y + (i / Y_TICKS) * plot.h, label: formatTrendValue(v)});
    }
  }

  return {pens: geometries, xTicks: timeTicks(from, to, stepSec, plot), yTicks, yScaleColor};
}
