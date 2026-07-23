import { useCallback, useMemo, useState } from "react";
import Konva from "konva";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { DiagramElement } from "@/types/editorElement.type";

interface HoverHighlightDeps {
  elementsMap: Record<string, DiagramElement>;
  elements: DiagramElement[];
  selectedIds: string[];
  resolveClickTarget: (key: string) => string | null;
}

/**
 * Hover-подсветка (как в Figma: показываем рамку того, что выберется по клику).
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

  const hoverBounds = useMemo(() => {
    if (!hoveredKey || selectedIds.includes(hoveredKey)) return null;
    const el = elementsMap[hoveredKey];
    if (!el) return null;
    // Для группы показываем её рамку (то, что выберется по клику); для листа — фактические границы.
    if (el.type === "group") {
      const abs = getAbsoluteRenderedPos(el, elementsMap);
      const rendered = getRenderedElement(el);
      return { x: abs.x, y: abs.y, w: rendered.w, h: rendered.h };
    }
    const b = getElementBoundsRendered(el, elements);
    return { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
  }, [hoveredKey, elementsMap, elements, selectedIds]);

  return { hoverBounds, handleStageMouseOver, clearHover };
}
