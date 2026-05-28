import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";

const buildBaseImage = (el: DiagramElement): Record<string, unknown> => {
  const visualProps = {...el} as Record<string, unknown>;

  delete visualProps.id;
  delete visualProps.key;
  delete visualProps.label;
  delete visualProps.parentId;
  delete visualProps.parentKey;
  delete visualProps.type;
  delete visualProps.children;
  delete visualProps.scripts;
  delete visualProps.bindings;
  delete visualProps.properties;
  delete visualProps.states;

  return visualProps;
};

const getOrderedChildren = (element: DiagramElement, elements: DiagramElement[]) => {
  const directChildren = elements.filter(child => String(child.parentKey) === String(element.key));
  const directChildrenMap = new Map(directChildren.map(child => [child.key, child]));

  return element.children?.length
    ? [
        ...element.children
          .map(childKey => directChildrenMap.get(String(childKey)))
          .filter((child): child is DiagramElement => Boolean(child)),
        ...directChildren.filter(child => !element.children.includes(child.key)),
      ]
    : directChildren;
};

const buildComponentNode = (element: DiagramElement, elements: DiagramElement[]): ComponentCreateDto => {
  const baseImage = buildBaseImage(element);
  const orderedChildren = getOrderedChildren(element, elements);

  const states = (element.states.length ? element.states : [{id: "default", name: "Нормальное", overrides: {}, isDefault: true}])
    .map((state, index) => ({
      name: state.name,
      image: JSON.stringify({...baseImage, ...(state.overrides ?? {})}),
      isDefault: state.isDefault ?? index === 0,
    }));

  return {
    id: element.id,
    key: element.key,
    name: element.label ?? "",
    children: orderedChildren.map(child => buildComponentNode(child, elements)),
    version: 0,
    type: element.type,
    parent_key: element.parentKey,
    parent_id: element.parentId,
    scripts: Array.isArray(element.scripts)
      ? element.scripts.map((s: any) => ({ name: s.name, script: s.content }))
      : [],
    bindings: Array.isArray(element.bindings)
      ? element.bindings.map((b: any) => ({
          component_property_id: b.component_property_id || 0,
          name: b.name || "",
          script: b.script || ""
        }))
      : [],
    states,
  };
};

export const buildComponentTree = (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] => {
  // If the backend expects a flat array of nodes for the whole tree
  // We can gather all elements that belong to this tree root
  const result: ComponentCreateDto[] = [];

  const processNode = (el: DiagramElement) => {
    result.push(buildComponentNode(el, elements));
    const children = getOrderedChildren(el, elements);
    children.forEach(child => processNode(child));
  };

  const rootElements = elements.filter(el => String(el.parentKey) === String(parentKey));
  rootElements.forEach(el => processNode(el));

  return result;
}

export const buildPaletteComponentTree = (
  elements: DiagramElement[],
  rootKey: string | null = null
): Record<string, any> | null => {
  const rootElement = rootKey
    ? elements.find(el => String(el.key) === String(rootKey))
    : elements.find(el => el.parentKey === null);

  if (!rootElement) return null;

  const buildNestedNode = (element: DiagramElement): Record<string, any> => {
    const baseImage = buildBaseImage(element);
    const orderedChildren = getOrderedChildren(element, elements);
    const states = (element.states.length ? element.states : [{id: "default", name: "Нормальное", overrides: {}, isDefault: true}])
      .map((state, index) => ({
        name: state.name,
        image: JSON.stringify({...baseImage, ...(state.overrides ?? {})}),
        isDefault: state.isDefault ?? index === 0,
      }));

    return {
      id: element.id,
      key: element.key,
      name: element.label ?? "",
      children: orderedChildren.map(child => buildNestedNode(child)),
      version: 0,
      type: element.type,
      parent_key: element.parentKey,
      parent_id: element.parentId,
      scripts: Array.isArray(element.scripts)
        ? element.scripts.map((s: any) => ({ name: s.name, script: s.content }))
        : [],
      bindings: Array.isArray(element.bindings)
        ? element.bindings.map((b: any) => ({
            component_property_id: b.component_property_id || 0,
            name: b.name || "",
            script: b.script || ""
          }))
        : [],
      states,
    };
  };

  return buildNestedNode(rootElement);
};

export const buildSingleComponentTree = (
  elements: DiagramElement[],
  rootKey: string | null = null // Ключ элемента, который мы считаем корнем
): ComponentCreateDto | null => {

  // 1. Ищем конкретный корневой элемент.
  // Если rootKey не передан, берем первый элемент, у которого parentKey === null
  const rootElement = rootKey
    ? elements.find(el => String(el.key) === String(rootKey))
    : elements.find(el => el.parentKey === null);

  if (!rootElement) return null;

  return buildComponentNode(rootElement, elements);
};