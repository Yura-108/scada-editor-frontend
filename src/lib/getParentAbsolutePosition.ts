import {DiagramElement} from "@/types/editorElement.type";
import getAbsolutePosition from "@/lib/getAbsolutePosition";


export default function getParentAbsolutePosition(
  element: DiagramElement,
  elements: DiagramElement[]
) {
  if (!element.parentId) return {x: 0, y: 0};


  const parent = elements.find(e => e.id === element.parentId);
  if (!parent) return {x: 0, y: 0};

  return getAbsolutePosition(parent, elements);
}