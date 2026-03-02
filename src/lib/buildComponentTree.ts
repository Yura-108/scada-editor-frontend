import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";

export default function buildComponentTree(
  elements: DiagramElement[],
  parentId: string | null = null,
): ComponentCreateDto[] {
  return elements
    .filter(el => el.parentId === parentId)
    .map(el => ({
      key: el.id,
      name: el.label ?? "",
      type: el.type,
      parent_key: el.parentId,
      version: 1,
      image: {x: el.x, y: el.y, w: el.w, h: el.h},
      children: buildComponentTree(elements, el.id)
    }))
}