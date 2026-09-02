import { DiagramElement } from "@/types/editorElement.type";
import { isConturMeta } from "@/lib/editor/conturImport";
import { GRID } from "@/lib/utils";

/**
 * Лист сцены.
 *
 * Схемы переносят с листов Eplan, поэтому у сцены есть конкретный размер, а не
 * абстрактный «мир 5000×5000» (тот был лишь протяжённостью отрисованной сетки).
 * Лист — **подсказка, а не запрет**: рамка видна, координаты не ограничены,
 * существующие схемы шире листа продолжают работать.
 *
 * Размер хранится **в единицах холста, а не форматом бумаги**: по замеру CONTUR
 * один и тот же A3 занимает от 7470 до 16200 единиц — масштаб задаёт не формат,
 * а то, насколько мелко Eplan нарисовал символы на конкретном листе.
 */
export interface SheetSize {
  w: number;
  h: number;
}

/**
 * A3 «технологический» — 15 из 24 замеренных листов CONTUR (символ 19–20 пт при
 * фигуре устройства 200 единиц). Точное значение высоты 8419, округлено к сетке
 * вниз — так это число согласовано с CONTUR.
 */
export const DEFAULT_SHEET: SheetSize = { w: 11900, h: 8400 };

/**
 * Пресеты для сцен, которые рисуют руками: номинал ISO при плотности «символ
 * 20 пт» (k = 10 единиц на пункт), альбомная ориентация, округление к сетке.
 *
 * Импортированной сцене пресет не нужен — она берёт свой размер из файла и
 * соответствовать номиналу не обязана: A0 у CONTUR при символе 31.3 пт —
 * 21520 × 15240, а не номинальные 33700 × 23840.
 */
export const SHEET_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "A5", w: 5960, h: 4200 },
  { label: "A4", w: 8420, h: 5960 },
  { label: "A3", w: DEFAULT_SHEET.w, h: DEFAULT_SHEET.h },
  { label: "A2", w: 16840, h: 11900 },
  { label: "A1", w: 23840, h: 16840 },
  { label: "A0", w: 33700, h: 23840 },
];

/** Минимальный лист — одна клетка; верх ограничиваем, чтобы опечатка не увела камеру. */
export const SHEET_MIN = GRID;
export const SHEET_MAX = 100000;

/**
 * Служебный элемент с данными листа. Фигурой не является (`visible: false`,
 * нулевой габарит), рендер и выделение его пропускают.
 *
 * Предикат переиспользуем из импорта CONTUR: служебный элемент придуман там, и
 * заводить второй признак того же самого — верный способ их рассинхронизировать.
 */
export const isMetaElement = (el: DiagramElement): boolean =>
  isConturMeta(el as unknown as Record<string, unknown>);

const positive = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Размер из блока `canvas` одного сырого элемента, если он там есть. */
export function readCanvasBlock(el: Record<string, unknown>): SheetSize | null {
  const canvas = el.canvas;
  if (!canvas || typeof canvas !== "object") return null;
  const w = positive((canvas as Record<string, unknown>).width);
  const h = positive((canvas as Record<string, unknown>).height);
  return w && h ? { w, h } : null;
}

/**
 * Размер листа в сыром массиве (до нормализации) — нужен импорту: проценты
 * обязаны считаться от листа, на котором чертёж нарисован.
 */
export function readSheetFromRaw(raw: Record<string, unknown>[]): SheetSize | null {
  for (const el of raw) {
    if (el && typeof el === "object" && isConturMeta(el)) {
      const size = readCanvasBlock(el);
      if (size) return size;
    }
  }
  return null;
}

/**
 * Кэш по ссылке на массив — тем же приёмом, что `getElementIndex`.
 *
 * Размер листа спрашивают на каждом кадре отрисовки, а любая правка схемы
 * создаёт новый массив (на этом же держатся `equality` истории undo и флаг
 * несохранённых правок), поэтому ссылка — корректный ключ кэша.
 */
const sheetCache = new WeakMap<DiagramElement[], SheetSize>();

/**
 * Размер листа сцены.
 *
 * Источник — блок `canvas` служебного элемента: выгрузка CONTUR несёт в нём
 * `{width, height, units, grid, scale, origin}`, то есть размер сцены в наших
 * единицах уже приезжает в файле. Блок переживает round-trip сам: `buildBaseImage`
 * работает по чёрному списку структурных ключей, всё остальное уходит в
 * `states[].image` и возвращается спредом.
 *
 * Нет элемента или нет блока — пресет по умолчанию. Значение вычисляется из
 * `elements`, а не хранится в сторе: иначе его пришлось бы синхронизировать во
 * всех точках, где массив меняется (загрузка, сохранение, восстановление версии,
 * просмотр версии, импорт), и любая забытая — это лист от прошлой сцены.
 */
export function resolveSheet(elements: DiagramElement[]): SheetSize {
  const cached = sheetCache.get(elements);
  if (cached) return cached;

  let sheet: SheetSize = { ...DEFAULT_SHEET };
  for (const el of elements) {
    if (!isMetaElement(el)) continue;
    const size = readCanvasBlock(el as unknown as Record<string, unknown>);
    if (size) { sheet = size; break; }
  }

  sheetCache.set(elements, sheet);
  return sheet;
}

/** Совпадают ли размеры (чтобы не писать в стор холостую правку). */
export const isSameSheet = (a: SheetSize, b: SheetSize): boolean =>
  a.w === b.w && a.h === b.h;
