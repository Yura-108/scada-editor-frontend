import {DiagramElement} from "@/types/editorElement.type";

export default function getAbsolutePosition(
  el: DiagramElement,
  elements: DiagramElement[]
): { x: number; y: number } {
  if (!el.parentId) {
    return { x: el.x, y: el.y };
  }

  const parent = elements.find(e => e.id === el.parentId);
  if (!parent) {
    return { x: el.x, y: el.y };
  }

  const parentAbs = getAbsolutePosition(parent, elements);

  return {
    x: parentAbs.x + el.x,
    y: parentAbs.y + el.y,
  };
}