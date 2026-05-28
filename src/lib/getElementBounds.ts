import getAbsolutePosition from "@/lib/getAbsolutePosition";
import {DiagramElement, LeafElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";

export const getElementBounds = (el: DiagramElement, elements: DiagramElement[]) => {
  const abs = getAbsolutePosition(el, elements);

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
      absY: abs.y
    };
  }

  const rendered = getRenderedElement(el) as LeafElement;
  const rotate = rendered.rotate || 0;
  const w = rendered.w || 0;
  const h = rendered.h || 0;

  if (!rotate) {
    return {
      minX: abs.x,
      minY: abs.y,
      maxX: abs.x + w,
      maxY: abs.y + h,
      absX: abs.x,
      absY: abs.y
    };
  }

  // Calculate rotated bounding box
  const cx = abs.x + w / 2;
  const cy = abs.y + h / 2;
  const radians = (rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const dx = w / 2;
  const dy = h / 2;

  const corners = [
    { x: -dx, y: -dy },
    { x: dx, y: -dy },
    { x: dx, y: dy },
    { x: -dx, y: dy }
  ].map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos
  }));

  const minX = Math.min(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y));
  const maxX = Math.max(...corners.map(p => p.x));
  const maxY = Math.max(...corners.map(p => p.y));

  return {
    minX,
    minY,
    maxX,
    maxY,
    absX: abs.x,
    absY: abs.y
  };
};