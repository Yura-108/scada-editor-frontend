import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";

export default function buildComponentTree(
  elements: DiagramElement[],
  parentId: string | null = null,
): ComponentCreateDto[] {
  return elements
    .filter(el => el.parentId === parentId)
    .map(el => {
      const {id, label, parentId, type, children, ...imageProps} = el;

      return {
        key: id,
        name: label ?? "",
        type,
        parent_key: parentId,
        version: 1,
        image: imageProps,
        children: buildComponentTree(elements, id),
      };
    });
}