import {DiagramElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";

/** Абсолютные координаты элемента на холсте (с учётом цепочки parentKey). */
export default function getAbsolutePosition(
  el: DiagramElement,
  elements: DiagramElement[],
): {x: number; y: number} {
  const parentKey = el.parentKey;

  if (parentKey == null || parentKey === "") {
    return {x: el.x ?? 0, y: el.y ?? 0};
  }

  const parent = elements.find(
    (e) => e.key === parentKey || String(e.id) === String(parentKey),
  );

  if (!parent) {
    return {x: el.x ?? 0, y: el.y ?? 0};
  }

  const parentAbs = getAbsolutePosition(parent, elements);

  return {
    x: parentAbs.x + (el.x ?? 0),
    y: parentAbs.y + (el.y ?? 0),
  };
}

/**
 * Rendered-aware version: uses getRenderedElement(el).x/y (includes state overrides)
 * at every level of the parent chain. Use this wherever actual visual position matters,
 * e.g. when taking a snapshot before grouping/ungrouping.
 */
export function getAbsoluteRenderedPosition(
  el: DiagramElement,
  elements: DiagramElement[],
): {x: number; y: number} {
  const rendered = getRenderedElement(el);
  const parentKey = el.parentKey;

  if (parentKey == null || parentKey === "") {
    return {x: rendered.x ?? 0, y: rendered.y ?? 0};
  }

  const parent = elements.find(
    (e) => e.key === parentKey || String(e.id) === String(parentKey),
  );

  if (!parent) {
    return {x: rendered.x ?? 0, y: rendered.y ?? 0};
  }

  const parentAbs = getAbsoluteRenderedPosition(parent, elements);

  return {
    x: parentAbs.x + (rendered.x ?? 0),
    y: parentAbs.y + (rendered.y ?? 0),
  };
}
