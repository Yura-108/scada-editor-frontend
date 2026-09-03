import { GRID } from "@/lib/utils";

/**
 * Раскладка полос таблицы: где проходят границы столбцов и строк.
 *
 * Ширины столбцов (`colWidths`) и высоты строк (`rowHeights`) хранятся в элементе как
 * **веса**, а не как готовые координаты: на чтении массив ВСЕГДА нормируется к текущему
 * доступному размеру (`w` для столбцов, `h − headerH` для строк). Из этого следует всё
 * остальное поведение:
 *
 *  - ресайз всей таблицы масштабирует столбцы и строки пропорционально, и коду ресайза
 *    (Transformer/ручки) не нужно знать про полосы вовсе — он правит только `w/h`;
 *  - рассинхрон «сумма полос ≠ размер таблицы» невозможен в принципе, поэтому нет ни
 *    отдельной валидации, ни миграции;
 *  - старая таблица (полей нет, `raw === undefined`) даёт равномерную сетку — ровно то,
 *    что рисовалось до появления этих полей.
 *
 * Модуль чистый: ни Konva, ни стора — так же, как соседние `tableCells.ts`/`tableBindings.ts`.
 */

/** Минимальная ширина столбца и высота строки — одна клетка сетки. */
export const MIN_TRACK = GRID;

/**
 * Высота шапки: явная (`headerH`) или, как раньше, производная от кегля.
 *
 * `headerH` намеренно необязателен: у таблиц, созданных до появления поля, его нет, и
 * высота обязана считаться по-старому, иначе шапка у них скакнёт.
 */
export function headerHeight(showHeader: boolean, fontSize: number, headerH?: unknown): number {
  if (!showHeader) return 0;
  const explicit = Number(headerH);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(MIN_TRACK, explicit);
  return Math.max(20, fontSize + 10);
}

/**
 * Абсолютные размеры полос из хранимых весов.
 *
 * Длина подгоняется под `count`: лишние веса отбрасываются, недостающие добираются
 * средним по уже имеющимся — поэтому смена «Строк»/«Столбцов» в панели не ломает
 * раскладку и не требует синхронной правки массива.
 */
export function resolveTracks(raw: unknown, count: number, total: number): number[] {
  const size = Math.max(1, Math.round(count));
  const space = Math.max(0, total);

  // Места меньше, чем минимум на все полосы — клампить нечем, режем поровну.
  if (space <= size * MIN_TRACK) return new Array(size).fill(space / size);

  const weights: number[] = [];
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) weights.push(n);
    }
  }

  if (weights.length === 0) return new Array(size).fill(space / size);

  // Недостающие полосы получают средний вес, лишние отбрасываются.
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  const fitted = weights.slice(0, size);
  while (fitted.length < size) fitted.push(avg);

  const sum = fitted.reduce((a, b) => a + b, 0);
  const scaled = fitted.map(v => (v / sum) * space);

  return clampTracks(scaled, space);
}

/**
 * Подтягивает полосы меньше минимума до `MIN_TRACK`, забирая недостачу у остальных
 * пропорционально. Сумма сохраняется — вызывающему не нужно чинить её отдельно.
 */
function clampTracks(sizes: number[], total: number): number[] {
  const out = sizes.slice();
  let deficit = 0;
  let donors = 0;

  for (let i = 0; i < out.length; i++) {
    if (out[i] < MIN_TRACK) {
      deficit += MIN_TRACK - out[i];
      out[i] = MIN_TRACK;
    } else {
      donors += out[i] - MIN_TRACK;
    }
  }

  if (deficit === 0 || donors <= 0) return out;

  const ratio = Math.min(1, deficit / donors);
  for (let i = 0; i < out.length; i++) {
    if (out[i] > MIN_TRACK) out[i] -= (out[i] - MIN_TRACK) * ratio;
  }

  // Округления могли увести сумму на доли пикселя — сажаем остаток на последнюю полосу.
  const drift = total - out.reduce((a, b) => a + b, 0);
  out[out.length - 1] += drift;
  return out;
}

/** Префиксные суммы: `offsets[i]` — начало полосы `i`, `offsets[count]` — конец последней. */
export function trackOffsets(sizes: number[]): number[] {
  const out = [0];
  for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i]);
  return out;
}

/**
 * Полосы после переноса границы `index` (1..count−1) на координату `pos`.
 *
 * Меняются только две соседние полосы, сумма сохраняется — так ведёт себя граница
 * столбца в любой таблице, и это же свойство держит нормировку неизменной.
 */
export function resizeTrackAt(sizes: number[], index: number, pos: number): number[] {
  if (index <= 0 || index >= sizes.length) return sizes;

  const offsets = trackOffsets(sizes);
  const start = offsets[index - 1];
  const end = offsets[index + 1];
  const clamped = Math.min(end - MIN_TRACK, Math.max(start + MIN_TRACK, pos));

  const out = sizes.slice();
  out[index - 1] = clamped - start;
  out[index] = end - clamped;
  return out;
}

/**
 * Полосы после задания полосе `index` размера `size` (числовое поле панели).
 *
 * Разница снимается с соседней полосы — той же, что двигалась бы при перетаскивании
 * правой (нижней) границы; у последней полосы соседом выступает предыдущая.
 */
export function setTrackSize(sizes: number[], index: number, size: number): number[] {
  if (index < 0 || index >= sizes.length || sizes.length < 2) return sizes;

  const offsets = trackOffsets(sizes);
  // Последняя полоса не имеет правой соседки — двигаем её ЛЕВУЮ границу.
  return index === sizes.length - 1
    ? resizeTrackAt(sizes, index, offsets[index + 1] - size)
    : resizeTrackAt(sizes, index + 1, offsets[index] + size);
}

/** Совпадают ли раскладки с точностью до доли пикселя (сравнение результатов ресайза). */
export function sameTracks(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 0.01) return false;
  }
  return true;
}
