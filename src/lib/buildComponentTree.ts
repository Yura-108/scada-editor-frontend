import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";
import {ComponentCreateDTO} from "@/types/palette.types";

export const buildComponentTree = (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] => {
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

export const buildComponentCreateDTO =  (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDTO[] => {
  return elements
    .filter(el => el.parentKey === parentKey)
    .map(el => {
      const {id,key, label, parentId, type, children, parentKey, ...imageProps} = el;

      return {
        key,
        name: label ?? "",
        type,
        parent_key: parentKey,
        image: imageProps,
        children: buildComponentCreateDTO(elements, key),
      };
    });
}