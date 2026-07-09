import { DiagramElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";

/**
 * Абсолютная мировая позиция элемента с учётом rendered-координат (state overrides)
 * на каждом уровне вложенности.
 */
export function getAbsoluteRenderedPos(
  el: DiagramElement,
  elementsMap: Record<string, DiagramElement>,
): { x: number; y: number } {
  const rendered = getRenderedElement(el);
  const parent = el.parentKey ? elementsMap[el.parentKey] : null;
  if (!parent) return { x: rendered.x ?? 0, y: rendered.y ?? 0 };
  const parentPos = getAbsoluteRenderedPos(parent, elementsMap);
  return { x: parentPos.x + (rendered.x ?? 0), y: parentPos.y + (rendered.y ?? 0) };
}
