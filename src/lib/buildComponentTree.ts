import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";
import {ComponentCreateDTO} from "@/types/palette.types";

const buildBaseImage = (el: DiagramElement): Record<string, unknown> => {
  const visualProps = {...el} as Record<string, unknown>;

  delete visualProps.id;
  delete visualProps.key;
  delete visualProps.label;
  delete visualProps.parentId;
  delete visualProps.parentKey;
  delete visualProps.type;
  delete visualProps.children;
  delete visualProps.properties;
  delete visualProps.states;

  return visualProps;
};

export const buildComponentTree = (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] => {
  void parentKey;

  return elements
    .map(el => {
      const baseImage = buildBaseImage(el);
      const states = (el.states.length ? el.states : [{id: "default", name: "Нормальное", overrides: {}, isDefault: true}])
        .map((state, index) => ({
          name: state.name,
          image: JSON.stringify({...baseImage, ...(state.overrides ?? {})}),
          isDefault: state.isDefault ?? index === 0,
        }));

      return {
        id: el.id,
        key: el.key,
        name: el.label ?? "",
        children: (el.children ?? []).map(String),
        version: 1,
        type: el.type,
        parent_key: el.parentKey,
        parent_id: el.parentId,
        states,
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
        const { key, label, type, parentKey, ...imageProps } = el;
        delete (imageProps as Record<string, unknown>).children;
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