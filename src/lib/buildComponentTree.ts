import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";
import {ComponentCreateDTO} from "@/types/palette.types";

export const buildComponentTree = (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] => {
  return elements
    .filter(el => el.parentKey === parentKey)
    .map(el => {
      const {id,key, label, parentId, type, parentKey, ...imageProps} = el;

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

export const buildSingleComponentTree = (
  elements: DiagramElement[],
  rootKey: string | null = null // Ключ элемента, который мы считаем корнем
): ComponentCreateDTO | null => {

  // 1. Ищем конкретный корневой элемент.
  // Если rootKey не передан, берем первый элемент, у которого parentKey === null
  const rootElement = rootKey
    ? elements.find(el => String(el.key) === String(rootKey))
    : elements.find(el => el.parentKey === null);

  if (!rootElement) return null;

  // 2. Внутренняя функция для рекурсивной сборки детей
  const getChildren = (currentKey: string): ComponentCreateDTO[] => {
    return elements
      .filter(el => String(el.parentKey) === String(currentKey))
      .map(el => {
        const { key, label, type, children, parentKey, ...imageProps } = el;
        return {
          key,
          type,
          name: label ?? "",
          parent_key: parentKey,
          children: getChildren(String(key)),
          image: imageProps,
        };
      });
  };

  // 3. Формируем итоговый объект для найденного корня
  const { key, label, type, parentKey, ...imageProps } = rootElement;

  return {
    key,
    name: label ?? "",
    type,
    parent_key: parentKey,
    image: imageProps,
    children: getChildren(String(key)),
  };
};