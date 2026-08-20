import { DiagramElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";

/**
 * Абсолютный bbox элемента для проверки попадания в рамку выделения (marquee).
 * Учитывает специфику polygon (локальные вершины) и line (x1/y1/x2/y2).
 */
export function getSelectionBounds(
  el: DiagramElement,
  elementsMap: Record<string, DiagramElement>,
): { x: number; y: number; w: number; h: number } {
  const rendered = getRenderedElement(el);
  const absPos = getAbsoluteRenderedPos(el, elementsMap);

  if (rendered.type === "polygon") {
    // Вершины хранятся локально внутри polygon Group.
    const pts: number[] = Array.isArray(rendered.points)
      ? (rendered.points as number[])
      : (() => { try { return JSON.parse((rendered.points as string | undefined) ?? "[]"); } catch { return []; } })();

    if (pts.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < pts.length; i += 2) {
        minX = Math.min(minX, absPos.x + pts[i]);
        minY = Math.min(minY, absPos.y + pts[i + 1]);
        maxX = Math.max(maxX, absPos.x + pts[i]);
        maxY = Math.max(maxY, absPos.y + pts[i + 1]);
      }
      return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
    }
  }

  if (rendered.type === "line") {
    // absPos = parentAbs + rendered.x  →  parentAbs = absPos - rendered.x
    const pax = absPos.x - (rendered.x ?? 0);
    const pay = absPos.y - (rendered.y ?? 0);
    const ax1 = pax + (rendered.x1 ?? rendered.x ?? 0);
    const ay1 = pay + (rendered.y1 ?? rendered.y ?? 0);
    const ax2 = pax + (rendered.x2 ?? ((rendered.x ?? 0) + 80));
    const ay2 = pay + (rendered.y2 ?? rendered.y ?? 0);
    return {
      x: Math.min(ax1, ax2),
      y: Math.min(ay1, ay2),
      w: Math.max(Math.abs(ax2 - ax1), 2),
      h: Math.max(Math.abs(ay2 - ay1), 2),
    };
  }

  return { x: absPos.x, y: absPos.y, w: rendered.w ?? 0, h: rendered.h ?? 0 };
}
