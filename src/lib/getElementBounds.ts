import getAbsolutePosition, {getAbsoluteRenderedPosition} from "@/lib/getAbsolutePosition";
import {DiagramElement, LeafElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";

export const getElementBounds = (el: DiagramElement, elements: DiagramElement[]) => {
  const abs = getAbsolutePosition(el, elements);

  if (el.type === "group") {
    const children = elements.filter((c) => String(c.parentKey) === String(el.key));

    if (children.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const child of children) {
        const childBounds = getElementBounds(child, elements);
        minX = Math.min(minX, childBounds.minX);
        minY = Math.min(minY, childBounds.minY);
        maxX = Math.max(maxX, childBounds.maxX);
        maxY = Math.max(maxY, childBounds.maxY);
      }

      return {
        minX,
        minY,
        maxX,
        maxY,
        absX: minX,
        absY: minY,
      };
    }
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

/**
 * Rendered-aware variant: uses getAbsoluteRenderedPosition (respects state overrides)
 * and getRenderedElement for w/h/points. Use this when you need the actual visual
 * position (e.g. before grouping elements that were dragged).
 */
export const getElementBoundsRendered = (el: DiagramElement, elements: DiagramElement[]) => {
  const abs = getAbsoluteRenderedPosition(el, elements);
  const rendered = getRenderedElement(el) as LeafElement;

  if (el.type === "group") {
    const children = elements.filter((c) => String(c.parentKey) === String(el.key));

    if (children.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const child of children) {
        const childBounds = getElementBoundsRendered(child, elements);
        minX = Math.min(minX, childBounds.minX);
        minY = Math.min(minY, childBounds.minY);
        maxX = Math.max(maxX, childBounds.maxX);
        maxY = Math.max(maxY, childBounds.maxY);
      }

      return {
        minX,
        minY,
        maxX,
        maxY,
        absX: minX,
        absY: minY,
      };
    }
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

  if (el.type === "polygon" || rendered.type === "polygon") {
    const pts: number[] = Array.isArray(rendered.points)
      ? (rendered.points as number[])
      : (() => { try { return JSON.parse((rendered.points as string | undefined) ?? "[]"); } catch { return []; } })();

    if (pts.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < pts.length; i += 2) {
        minX = Math.min(minX, abs.x + pts[i]);
        minY = Math.min(minY, abs.y + pts[i + 1]);
        maxX = Math.max(maxX, abs.x + pts[i]);
        maxY = Math.max(maxY, abs.y + pts[i + 1]);
      }
      return { minX, minY, maxX, maxY, absX: abs.x, absY: abs.y };
    }
  }

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
      absY: abs.y,
    };
  }

  const cx = abs.x + w / 2;
  const cy = abs.y + h / 2;
  const radians = (rotate * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = w / 2;
  const dy = h / 2;

  const corners = [
    { x: -dx, y: -dy }, { x: dx, y: -dy },
    { x: dx, y: dy },   { x: -dx, y: dy },
  ].map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  return {
    minX: Math.min(...corners.map(p => p.x)),
    minY: Math.min(...corners.map(p => p.y)),
    maxX: Math.max(...corners.map(p => p.x)),
    maxY: Math.max(...corners.map(p => p.y)),
    absX: abs.x,
    absY: abs.y,
  };
};