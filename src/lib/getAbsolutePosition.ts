import {DiagramElement} from "@/types/editorElement.type";

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
