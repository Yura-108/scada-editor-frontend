import type {DiagramElement, TrendPenStyle, TrendSettings} from "@/types/editorElement.type";
import type {PropertyCreateDto} from "@/types/tags.types";

/**
 * Тренд: перья, окно, шаг (контракт docs/contract/2026-09-28-tag-archive-contract.md, раздел 1).
 *
 * Перо — тег-свойство элемента (`property_type === "Тег"`), его `name` (`pen1`, `pen2`, …) —
 * ключ в `trend.pens`, где лежит оформление. Свойство без записи в `pens` рисуется цветом
 * по умолчанию и масштабом по данным; запись без свойства игнорируется.
 */

export const TREND_DEFAULTS = {window: 1800, step: 300, penWidth: 2} as const;

export const TREND_LIMITS = {
  /** От минуты до суток. Больше суток живое окно не держим — это уже отмотка по архиву. */
  window: {min: 60, max: 86_400},
  step: {min: 1, max: 86_400},
  width: {min: 1, max: 8},
} as const;

/** Пресеты окна — общие для редактора и окна тренда в мониторе. */
export const TREND_WINDOW_PRESETS: {label: string; seconds: number}[] = [
  {label: "5 мин", seconds: 300},
  {label: "15 мин", seconds: 900},
  {label: "30 мин", seconds: 1800},
  {label: "1 ч", seconds: 3600},
  {label: "4 ч", seconds: 14_400},
  {label: "8 ч", seconds: 28_800},
  {label: "24 ч", seconds: 86_400},
];

/** Цвета перьев по умолчанию — по порядку пера среди тег-свойств. */
export const TREND_PEN_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16",
];

const num = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const clamp = (v: number, {min, max}: {min: number; max: number}) => Math.min(max, Math.max(min, v));

const readPen = (raw: unknown): TrendPenStyle | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const pen: TrendPenStyle = {};
  if (typeof src.color === "string" && src.color) pen.color = src.color;
  const min = num(src.min);
  const max = num(src.max);
  if (min !== undefined) pen.min = min;
  if (max !== undefined) pen.max = max;
  const width = num(src.width);
  if (width !== undefined) pen.width = clamp(width, TREND_LIMITS.width);
  return Object.keys(pen).length ? pen : undefined;
};

/**
 * Разбор настроек из image или элемента: только конечные числа, в пределах. Данные едут
 * внутри непрозрачного JSON, и мусор в нём не должен ронять отрисовку. Ничего не задано —
 * `undefined`, чтобы элемент без настроек не таскал пустой объект.
 */
export function readTrendSettings(raw: unknown): TrendSettings | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const result: TrendSettings = {};
  const window = num(src.window);
  if (window !== undefined) result.window = Math.round(clamp(window, TREND_LIMITS.window));
  const step = num(src.step);
  if (step !== undefined) result.step = Math.round(clamp(step, TREND_LIMITS.step));
  if (typeof src.pens === "object" && src.pens !== null) {
    const pens: Record<string, TrendPenStyle> = {};
    for (const [name, value] of Object.entries(src.pens as Record<string, unknown>)) {
      const pen = readPen(value);
      if (pen) pens[name] = pen;
    }
    if (Object.keys(pens).length) result.pens = pens;
  }
  return Object.keys(result).length ? result : undefined;
}

/** Окно и шаг тренда в секундах, с дефолтами. */
export function trendTiming(settings: TrendSettings | undefined): {window: number; step: number} {
  const s = readTrendSettings(settings);
  return {window: s?.window ?? TREND_DEFAULTS.window, step: s?.step ?? TREND_DEFAULTS.step};
}

/** Перо, готовое к отрисовке. */
export interface TrendPen {
  name: string;
  /** Подпись в легенде: `label` свойства, иначе его `name`. */
  label: string;
  /** Путь тега. */
  tag: string;
  color: string;
  width: number;
  min?: number;
  max?: number;
}

export const isTrendPenProperty = (p: PropertyCreateDto): boolean =>
  p.property_type === "Тег" && !!p.tag_id;

/** Перья тренда: тег-свойства элемента + их оформление из `trend.pens`. */
export function trendPens(el: Pick<DiagramElement, "properties"> & {trend?: TrendSettings}): TrendPen[] {
  const styles = readTrendSettings(el.trend)?.pens ?? {};
  return (el.properties ?? [])
    .filter(isTrendPenProperty)
    .map((p, i) => {
      const name = p.name ?? "";
      const style = styles[name] ?? {};
      return {
        name,
        label: p.label?.trim() || name,
        tag: p.tag_id as string,
        color: style.color ?? TREND_PEN_COLORS[i % TREND_PEN_COLORS.length],
        width: style.width ?? TREND_DEFAULTS.penWidth,
        ...(style.min !== undefined ? {min: style.min} : {}),
        ...(style.max !== undefined ? {max: style.max} : {}),
      };
    });
}

/** Следующее свободное имя пера: `pen1`, `pen2`, … — по всем свойствам, не только тег-свойствам. */
export function nextPenName(properties: PropertyCreateDto[] | undefined): string {
  const taken = new Set((properties ?? []).map(p => p.name));
  for (let i = 1; ; i++) if (!taken.has(`pen${i}`)) return `pen${i}`;
}
