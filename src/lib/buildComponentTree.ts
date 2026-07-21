import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";
import {BindingDto} from "@/types/binding.types";

/**
 * id свойства элемента для DTO-поля `component_property_id` (контракт требует
 * число, ссылающееся на существующее свойство ИМЕННО этого компонента; 0 = «нет»).
 * Предпочитаем свойство-тег (исторически), но для биндингов на свойства других
 * компонентов у хоста тег-свойства может не быть — тогда годится любое сохранённое
 * свойство (проверить на бэкенде, что не-тег id принимается — см. план, Risks).
 */
const firstSavedPropertyId = (el: DiagramElement): number => {
  const props = el.properties ?? [];
  const tagProp = props.find(p => p.property_type === "Тег" && typeof p.id === "number");
  if (tagProp) return tagProp.id;
  const anyProp = props.find(p => typeof p.id === "number");
  return anyProp?.id ?? 0;
};

/**
 * TagBinding → DTO: биндинг целиком уезжает JSON-строкой в опак-поле `script`
 * (как states[].image — без изменения контракта бэкенда). Обратный путь —
 * parseBindings при загрузке.
 */
const encodeBindings = (el: DiagramElement): BindingDto[] =>
  Array.isArray(el.bindings)
    ? el.bindings.map(b => ({
        component_property_id: firstSavedPropertyId(el),
        name: b.name ?? "",
        script: JSON.stringify(b),
      }))
    : [];

const buildBaseImage = (el: DiagramElement): Record<string, unknown> => {
  const visualProps = {...el} as Record<string, unknown>;

  delete visualProps.id;
  delete visualProps.key;
  delete visualProps.label;
  delete visualProps.parentId;
  delete visualProps.parentKey;
  delete visualProps.type;
  delete visualProps.children;
  delete visualProps.composition; // список ключей примитивов — запекается отдельно, не в base
  delete visualProps.scripts;
  delete visualProps.bindings;
  delete visualProps.properties;
  delete visualProps.states;

  // isComponent намеренно оставляем в image — по нему восстанавливаем флаг при загрузке.
  return visualProps;
};

/**
 * Дескриптор примитива для запекания в image компонента: визуальные поля примитива
 * в конкретном состоянии (сопоставление по имени состояния, fallback — дефолтное).
 */
const buildShapeDescriptor = (
  primitive: DiagramElement,
  stateName: string,
): Record<string, unknown> => {
  const base = buildBaseImage(primitive);
  const state =
    primitive.states.find(s => s.name === stateName) ??
    primitive.states.find(s => s.isDefault) ??
    primitive.states[0];

  return {
    type: primitive.type,
    key: primitive.key,
    ...base,
    ...(state?.overrides ?? {}),
    // Данные примитива (теги/скрипты/биндинги) — иначе теряются при round-trip:
    // buildBaseImage их удаляет, а unbake восстанавливал бы пустые массивы.
    ...(primitive.scripts?.length ? {scripts: primitive.scripts} : {}),
    ...(Array.isArray(primitive.bindings) && primitive.bindings.length ? {bindings: primitive.bindings} : {}),
    ...(primitive.properties?.length ? {properties: primitive.properties} : {}),
  };
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

  const byKey = new Map(elements.map(e => [e.key, e] as const));

  // Компонент: примитивы composition запекаются в image, узлами идут только компоненты.
  // «Глупая» группа / прочее: поведение как раньше — все прямые дети становятся узлами.
  const compositionPrimitives = element.isComponent
    ? (element.composition ?? [])
        .map(k => byKey.get(k))
        .filter((e): e is DiagramElement => Boolean(e))
    : [];
  const childNodes = element.isComponent
    ? (element.children ?? [])
        .map(k => byKey.get(k))
        .filter((e): e is DiagramElement => Boolean(e))
    : getOrderedChildren(element, elements);

  const states = (element.states.length ? element.states : [{id: "default", name: "Нормальное", overrides: {}, isDefault: true}])
    .map((state, index) => {
      const stateImage: Record<string, unknown> = {...baseImage, ...(state.overrides ?? {})};
      if (element.isComponent && compositionPrimitives.length) {
        stateImage.composition = compositionPrimitives.map(p => buildShapeDescriptor(p, state.name));
      }
      return {
        name: state.name,
        image: JSON.stringify(stateImage),
        isDefault: state.isDefault ?? index === 0,
      };
    });

  return {
    id: element.id,
    key: element.key,
    name: element.label ?? "",
    children: childNodes.map(child => buildComponentNode(child, elements)),
    version: 0,
    type: element.type,
    parent_key: element.parentKey,
    parent_id: element.parentId,
    scripts: Array.isArray(element.scripts)
      ? element.scripts.map((s) => ({name: s.name, script: s.content}))
      : [],
    bindings: encodeBindings(element),
    states,
  };
};

/** Корневые компоненты сцены; в `children` — полные вложенные объекты (рекурсивно). */
export const buildComponentTree = (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] => {
  const rootElements = elements.filter(el => String(el.parentKey) === String(parentKey));
  return rootElements.map(el => buildComponentNode(el, elements));
};

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

    // Include non-tag properties in the template.
    // Tag-based properties (tag_id non-empty) are excluded because they reference
    // specific tags that won't be valid in other scenes where this template is used.
    // Server-assigned id and component_id are stripped — the server will reassign them.
    const templateProperties = Array.isArray(element.properties)
      ? element.properties
          .filter((p: any) => !p.tag_id)
          .map(({ id: _id, component_id: _cid, ...rest }: any) => rest)
      : [];

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
      bindings: encodeBindings(element),
      states,
      properties: templateProperties,
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