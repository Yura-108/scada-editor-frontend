import {DiagramElement} from "@/types/editorElement.type";
import getAbsolutePosition from "@/lib/getAbsolutePosition";

export default function getParentAbsolutePosition(
  element: DiagramElement,
  elements: DiagramElement[],
) {
  const parentKey = element.parentKey;

  if (parentKey == null || parentKey === "") {
    return {x: 0, y: 0};
  }

  const parent = elements.find(
    (e) => e.key === parentKey || String(e.id) === String(parentKey),
  );

  if (!parent) {
    return {x: 0, y: 0};
  }

  return getAbsolutePosition(parent, elements);
}
