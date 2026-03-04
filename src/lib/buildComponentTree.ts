import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";

export default function buildComponentTree(
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] {
  return elements
    .filter(el => el.parentKey === parentKey)
    .map(el => {
      const {id,key, label, parentId, type, children, parentKey, ...imageProps} = el;

      return {
        id,
        key,
        name: label ?? "",
        type,
        parent_key: parentKey,
        parent_id: parentId,
        version: 1,
        image: imageProps,
        children: buildComponentTree(elements, key),
      };
    });
}