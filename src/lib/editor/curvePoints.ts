/**
 * Точки кривой линии (`curve`) — кубическая кривая Безье.
 *
 * Хранятся ЛОКАЛЬНО относительно `x, y` элемента, ровно как вершины полигона:
 * `[x0,y0, c1x,c1y, c2x,c2y, x1,y1]` — начало, две направляющие, конец.
 *
 * Модуль отдельный, потому что читают его и рендер (`CurveShapeElement`), и расчёт
 * границ (`getElementBounds`, `getSelectionBounds`) — а тем ничего не должно быть
 * известно про компоненты холста.
 */

/** Длина массива точек: 4 точки × 2 координаты. */
export const CURVE_POINTS_LENGTH = 8;

/** Кривая по умолчанию: аккуратная арка 160×60 с точками по узлам сетки. */
export const DEFAULT_CURVE_POINTS: number[] = [0, 60, 40, 0, 120, 0, 160, 60];

/**
 * Разбирает `points`: массив чисел либо JSON-строка (импорт присылает и так, и так).
 * Всё, что не похоже на кубическую кривую, заменяется значением по умолчанию —
 * рендер и геометрия обязаны получить ровно восемь чисел.
 */
export const parseCurvePoints = (raw: unknown): number[] => {
  const parsed = Array.isArray(raw)
    ? raw
    : (() => {
        if (typeof raw !== "string") return null;
        try {
          const value = JSON.parse(raw);
          return Array.isArray(value) ? value : null;
        } catch {
          return null;
        }
      })();

  if (!parsed || parsed.length !== CURVE_POINTS_LENGTH) return [...DEFAULT_CURVE_POINTS];
  return parsed.every(n => Number.isFinite(n)) ? (parsed as number[]) : [...DEFAULT_CURVE_POINTS];
};

/**
 * Габарит по точкам — включая направляющие.
 *
 * Настоящая кривая всегда лежит внутри выпуклой оболочки своих четырёх точек, то есть
 * рамка получается с запасом там, где направляющие вынесены далеко. Это осознанный
 * размен: так габарит совпадает с тем, что видит и таскает пользователь (ручки), а не
 * пляшет при каждом сдвиге направляющей.
 */
export const curvePointsBounds = (points: number[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    if (points[i] < minX) minX = points[i];
    if (points[i] > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }
  return {minX, minY, maxX, maxY};
};
