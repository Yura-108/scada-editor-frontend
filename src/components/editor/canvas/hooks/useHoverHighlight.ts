import { useCallback, useMemo, useState } from "react";
import Konva from "konva";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { DiagramElement, LeafElement } from "@/types/editorElement.type";

interface HoverHighlightDeps {
  elementsMap: Record<string, DiagramElement>;
  elements: DiagramElement[];
  selectedIds: string[];
  resolveClickTarget: (key: string) => string | null;
}

/**
 * Форма hover-подсветки в абсолютных координатах холста.
 *
 * Не габаритный прямоугольник, а геометрия самой фигуры: у наклонного отрезка длиной в пол-листа
 * габарит — это огромный прямоугольник, накрывающий и соседние линии, и по нему невозможно понять,
 * что именно выберется по клику. Особенно на импортированном чертеже, где таких отрезков тысячи.
 */
export type HoverHighlight =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "line"; points: number[] }
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "polygon"; points: number[] };

/** Разбирает `points` полигона: массив чисел либо JSON-строка (та же форма, что у getElementBounds). */
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

/**
 * Hover-подсветка (как в Figma: показываем контур того, что выберется по клику).
 * Для члена группы это рамка самой группы — сразу видно, что элементы объединены.
 */
export function useHoverHighlight({ elementsMap, elements, selectedIds, resolveClickTarget }: HoverHighlightDeps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const handleStageMouseOver = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    let node: Konva.Node | null = e.target;
    let key: string | null = null;
    // id элемента может лежать на группе выше цели (Arrow у линии, Circle у круга и т.п.)
    for (let i = 0; i < 4 && node; i++) {
      const id = node.id();
      if (id && elementsMap[id]) { key = id; break; }
      node = node.getParent();
    }
    setHoveredKey(key ? resolveClickTarget(key) : null);
  }, [elementsMap, resolveClickTarget]);

  const clearHover = useCallback(() => setHoveredKey(null), []);

  const hoverHighlight = useMemo<HoverHighlight | null>(() => {
    if (!hoveredKey || selectedIds.includes(hoveredKey)) return null;
    const el = elementsMap[hoveredKey];
    if (!el) return null;

    // Для группы показываем её рамку (то, что выберется по клику).
    if (el.type === "group") {
      const abs = getAbsoluteRenderedPos(el, elementsMap);
      const rendered = getRenderedElement(el);
      return { kind: "rect", x: abs.x, y: abs.y, w: rendered.w, h: rendered.h };
    }

    const rendered = getRenderedElement(el) as LeafElement;

    // Отрезок подсвечиваем по самому отрезку. Абсолютные концы уже считает getElementBounds —
    // он же учитывает смещение родительской группы.
    if (rendered.type === "line") {
      const b = getElementBoundsRendered(el, elements);
      if (b.absX1 !== undefined && b.absY1 !== undefined && b.absX2 !== undefined && b.absY2 !== undefined) {
        return { kind: "line", points: [b.absX1, b.absY1, b.absX2, b.absY2] };
      }
    }

    // Круг: подсветка тем же кругом, а не описанным квадратом. Центр = x + radius —
    // так же, как его рисует ShapeElement.
    if (rendered.type === "circle") {
      const abs = getAbsoluteRenderedPos(el, elementsMap);
      const radius = rendered.radius || (rendered.w || 0) / 2;
      if (radius > 0) {
        return { kind: "circle", x: abs.x + radius, y: abs.y + radius, radius };
      }
    }

    // Многоугольник: обводим по вершинам. Точки локальны относительно x/y элемента.
    if (rendered.type === "polygon") {
      const pts = parsePoints(rendered.points);
      if (pts.length >= 6) {
        const abs = getAbsoluteRenderedPos(el, elementsMap);
        const absolute: number[] = [];
        for (let i = 0; i + 1 < pts.length; i += 2) {
          absolute.push(abs.x + pts[i], abs.y + pts[i + 1]);
        }
        return { kind: "polygon", points: absolute };
      }
    }

    // Всё остальное — прямоугольные фигуры и виджеты, у них габарит и есть форма.
    const b = getElementBoundsRendered(el, elements);
    return { kind: "rect", x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
  }, [hoveredKey, elementsMap, elements, selectedIds]);

  return { hoverHighlight, handleStageMouseOver, clearHover };
}
