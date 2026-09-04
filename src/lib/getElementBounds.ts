import {absolutePosition} from "@/lib/getAbsolutePosition";
import {DiagramElement, LeafElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {ElementIndex, getChildElements, getElementIndex} from "@/lib/editor/elementIndex";
import {measureText} from "@/lib/editor/measureText";

/**
 * Габарит элемента И его начало координат — это РАЗНЫЕ вещи, и путать их нельзя.
 *
 * - `minX/minY/maxX/maxY` — видимый габаритный прямоугольник в мировых координатах.
 * - `absX/absY` — НАЧАЛО КООРДИНАТ элемента, то есть его `x/y`, поднятые до мировых.
 *   Именно это значение нужно всему, что переводит элемент в другую систему координат
 *   (`elementToGroupLocal` пишет его обратно в `el.x`).
 *
 * Совпадают они далеко не всегда: у повёрнутого бокса габарит шире фигуры, а у ГРУППЫ
 * габарит — объединение детей, тогда как origin лежит на `GROUP_PADDING` левее и выше
 * (рамка группы рисуется с отступом вокруг содержимого). Подмена origin габаритом у
 * групп и приводила к тому, что вложенная группа при перегруппировке уезжала вправо-вниз
 * ровно на этот отступ, накапливая сдвиг с каждым уровнем вложенности.
 */
export interface ElementBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  absX: number;
  absY: number;
  absX1?: number;
  absY1?: number;
  absX2?: number;
  absY2?: number;
}

/**
 * Поворот габарита элемента, °.
 *
 * У дуги `rotate` — это начало дуги, а не поворот фигуры: её габарит — описанный
 * квадрат `2r × 2r`, от угла он не зависит. Крутить его как бокс значило бы раздувать
 * рамку выделения (и рамку группы-предка) на ровном месте при каждом повороте дуги.
 *
 * У текста `rotation` не прокидывается в Konva вовсе (см. TextShapeElement), поэтому
 * `rotate`, приехавший импортом или вставкой, раздувал бы AABB вокруг фигуры, которая
 * на холсте стоит ровно.
 */
const rotationOf = (rendered: LeafElement): number =>
  rendered.type === "arc" || rendered.type === "text" ? 0 : (rendered.rotate || 0);

/** Габаритный прямоугольник повёрнутого бокса w×h с левым верхним углом в (x, y). */
const rotatedBoxBounds = (x: number, y: number, w: number, h: number, rotate: number): ElementBounds => {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radians = (rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = w / 2;
  const dy = h / 2;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of [{x: -dx, y: -dy}, {x: dx, y: -dy}, {x: dx, y: dy}, {x: -dx, y: dy}]) {
    const px = cx + p.x * cos - p.y * sin;
    const py = cy + p.x * sin + p.y * cos;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  return {minX, minY, maxX, maxY, absX: x, absY: y};
};

/**
 * Габарит текста — по измеренным глифам, а не по `w/h` из модели.
 *
 * У текста `w/h` описывают что угодно, только не нарисованное: `80×80` от рождения,
 * `h` не пишется никогда, `w` действует лишь в режиме фиксированной ширины. Считая по
 * ним, рамка группы обжимала пустоту, направляющие липли не к тем краям, а поворот
 * (`transformSelection`) отражал текст относительно фантомного квадрата.
 */
const textBounds = (rendered: LeafElement, abs: {x: number; y: number}): ElementBounds => {
  const {w, h} = measureText(rendered);
  return {minX: abs.x, minY: abs.y, maxX: abs.x + w, maxY: abs.y + h, absX: abs.x, absY: abs.y};
};

/**
 * Границы группы = объединение границ её прямых детей (рекурсивно).
 *
 * `absX/absY` — это origin САМОЙ группы (`abs`), а не минимум детей: рамка группы
 * рисуется с отступом вокруг содержимого, поэтому origin лежит левее и выше габарита.
 * См. контракт у `ElementBounds`.
 */
const groupChildrenBounds = (
  el: DiagramElement,
  index: ElementIndex,
  abs: {x: number; y: number},
  boundsOf: (child: DiagramElement) => ElementBounds,
): ElementBounds | null => {
  const children = getChildElements(el.key, index);
  if (!children.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const child of children) {
    const b = boundsOf(child);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  return {minX, minY, maxX, maxY, absX: abs.x, absY: abs.y};
};

/** Разбирает `points` полигона: массив чисел либо JSON-строка. */
const parsePoints = (raw: unknown): number[] => {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getElementBounds = (el: DiagramElement, elements: DiagramElement[]): ElementBounds =>
  elementBounds(el, getElementIndex(elements));

/**
 * Rendered-aware variant: uses getRenderedElement for x/y/w/h/points. Use this when
 * you need the actual visual position (e.g. before grouping elements that were dragged).
 */
export const getElementBoundsRendered = (el: DiagramElement, elements: DiagramElement[]): ElementBounds =>
  elementBoundsRendered(el, getElementIndex(elements));

/** Базовые (не rendered) границы поверх готового индекса. */
export function elementBounds(el: DiagramElement, index: ElementIndex): ElementBounds {
  const abs = absolutePosition(el, index, false);

  if (el.type === "group") {
    const groupBounds = groupChildrenBounds(el, index, abs, child => elementBounds(child, index));
    if (groupBounds) return groupBounds;
  }

  if (el.type === "line") {
    const offsetX = abs.x - (el.x || 0);
    const offsetY = abs.y - (el.y || 0);

    const absX1 = (el.x1 || 0) + offsetX;
    const absY1 = (el.y1 || 0) + offsetY;
    const absX2 = (el.x2 || 0) + offsetX;
    const absY2 = (el.y2 || 0) + offsetY;

    return {
      minX: Math.min(absX1, absX2),
      minY: Math.min(absY1, absY2),
      maxX: Math.max(absX1, absX2),
      maxY: Math.max(absY1, absY2),
      absX1, absY1, absX2, absY2,
      absX: abs.x,
      absY: abs.y,
    };
  }

  const rendered = getRenderedElement(el) as LeafElement;

  if (rendered.type === "text") return textBounds(rendered, abs);

  const w = rendered.w || 0;
  const h = rendered.h || 0;
  const rotate = rotationOf(rendered);

  if (rotate) return rotatedBoxBounds(abs.x, abs.y, w, h, rotate);

  return {
    minX: abs.x,
    minY: abs.y,
    maxX: abs.x + w,
    maxY: abs.y + h,
    absX: abs.x,
    absY: abs.y,
  };
}

/** Rendered-границы поверх готового индекса. */
export function elementBoundsRendered(el: DiagramElement, index: ElementIndex): ElementBounds {
  const abs = absolutePosition(el, index, true);
  const rendered = getRenderedElement(el) as LeafElement;

  if (el.type === "group") {
    const groupBounds = groupChildrenBounds(el, index, abs, child => elementBoundsRendered(child, index));
    if (groupBounds) return groupBounds;
  }

  if (el.type === "line" || rendered.type === "line") {
    const rx = rendered.x ?? 0;
    const ry = rendered.y ?? 0;
    const offsetX = abs.x - rx;
    const offsetY = abs.y - ry;

    const absX1 = (rendered.x1 ?? rx) + offsetX;
    const absY1 = (rendered.y1 ?? ry) + offsetY;
    const absX2 = (rendered.x2 ?? rx + 80) + offsetX;
    const absY2 = (rendered.y2 ?? ry) + offsetY;

    return {
      minX: Math.min(absX1, absX2),
      minY: Math.min(absY1, absY2),
      maxX: Math.max(absX1, absX2),
      maxY: Math.max(absY1, absY2),
      absX1, absY1, absX2, absY2,
      absX: abs.x,
      absY: abs.y,
    };
  }

  // Кривая — те же локальные точки, что у полигона (у неё это концы и направляющие).
  const isPointsShape = (t: string) => t === "polygon" || t === "curve";
  if (isPointsShape(el.type) || isPointsShape(rendered.type)) {
    const pts = parsePoints(rendered.points);

    if (pts.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const px = abs.x + pts[i];
        const py = abs.y + pts[i + 1];
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      return {minX, minY, maxX, maxY, absX: abs.x, absY: abs.y};
    }
  }

  if (el.type === "text" || rendered.type === "text") return textBounds(rendered, abs);

  const w = rendered.w || 0;
  const h = rendered.h || 0;
  const rotate = rotationOf(rendered);

  if (rotate) return rotatedBoxBounds(abs.x, abs.y, w, h, rotate);

  return {
    minX: abs.x,
    minY: abs.y,
    maxX: abs.x + w,
    maxY: abs.y + h,
    absX: abs.x,
    absY: abs.y,
  };
}
