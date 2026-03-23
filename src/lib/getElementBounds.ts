import getAbsolutePosition from "@/lib/getAbsolutePosition";
import {DiagramElement} from "@/types/editorElement.type";

export const getElementBounds = (el: DiagramElement, elements: DiagramElement[]) => {
  const abs = getAbsolutePosition(el, elements);

  if (el.type === "line") {
    // Вычисляем абсолютное смещение родителя, чтобы получить абсолютные x1, y1, x2, y2
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
      absY: abs.y
    };
  }

  return {
    minX: abs.x,
    minY: abs.y,
    maxX: abs.x + (el.w || 0),
    maxY: abs.y + (el.h || 0),
    absX: abs.x,
    absY: abs.y
  };
};