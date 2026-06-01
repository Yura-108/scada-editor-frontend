import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";
import {createUuid} from "@/lib/createUuid";

type BackendStateDto = {
  id?: number | string;
  componentId?: number;
  name: string;
  image: string;
  isDefault?: boolean;
};

type BackendPropertyDto = {
  id: number;
  component_id: number;
  property_type: string | null;
  tag_id: string;
  description: string | null;
  value_type: string | null;
  default_value: string | null;
  logging: boolean;
  onChange: string | null;
};

type ComponentDto = {
  id: number;
  key?: string;
  name: string;
  type: string;
  version?: number;
  parent_id: number | null;
  scripts?: unknown[];
  bindings?: unknown[];
  states?: BackendStateDto[];
  children?: Array<ComponentDto | string | number>;
  properties?: BackendPropertyDto[];
};

const parseStateImage = (rawImage: string): Record<string, unknown> => {
  if (!rawImage) return {};

  try {
    const parsed = JSON.parse(rawImage);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const toFiniteNumber = (value: unknown, fallback: number) => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeArray = <T,>(value: T[] | undefined | null) => Array.isArray(value) ? value : [];

export default function transformElements(apiElements: ComponentDto[] = []) {
  const {scene} = useEditorStore.getState();

  if (!Array.isArray(apiElements)) {
    return [];
  }

  const flattenNode = (el: ComponentDto, fallbackParentId: number | null = null, fallbackParentKey: string | null = null): DiagramElement[] => {
    // 1. Ensure every element has a truly unique key for the editor session.
    // We cannot rely on api id because it might be 0 or non-unique across different types.
    const elementKey = el.key || createUuid();

    const normalizedStates = (el.states ?? []).map((state, index) => ({
      id: state.id != null ? String(state.id) : createUuid(),
      name: state.name,
      overrides: parseStateImage(state.image),
      isDefault: state.isDefault ?? index === 0,
    }));

    const defaultState =
      normalizedStates.find(state => state.isDefault) ??
      normalizedStates[0] ??
      {
        id: createUuid(),
        name: "Нормальное",
        overrides: {},
        isDefault: true,
      };

    const image = defaultState.overrides;

    // Handle children: they might be objects (ComponentDto) or strings/numbers
    const rawChildren = el.children ?? [];

    const resolvedParentId = el.parent_id ?? fallbackParentId ?? scene?.id ?? null;
    const resolvedParentKey = fallbackParentKey ?? (resolvedParentId != null
      ? String(resolvedParentId)
      : String(scene?.id ?? ""));

    const flattenedElement = {
      id: el.id,
      key: elementKey,
      type: el.type,
      x: toFiniteNumber(image.x, 0),
      y: toFiniteNumber(image.y, 0),
      w: toFiniteNumber(image.w, 80),
      h: toFiniteNumber(image.h, 80),
      composition: Boolean(image.composition),
      ...(image || {}),
      states: normalizedStates,
      parentId: resolvedParentId,
      parentKey: resolvedParentKey,
      children: [], // Will be populated by children's processing
      scripts: normalizeArray(el.scripts),
      bindings: normalizeArray(el.bindings),
      properties: Array.isArray(el.properties) ? el.properties : [],
      label: el.name,
    };

    // Process children recursively and collect their new unique keys
    const childResults: DiagramElement[] = [];
    const childKeys: string[] = [];

    rawChildren.forEach(child => {
      if (typeof child === "object" && child !== null) {
        const childElements = flattenNode(child as ComponentDto, el.id, elementKey);
        const firstChild = childElements[0];
        if (firstChild) {
          childKeys.push(firstChild.key);
          childResults.push(...childElements);
        }
      } else {
        // If it's just an ID, we can't fully flatten it without the object,
        // but we keep the reference.
        childKeys.push(String(child));
      }
    });

    flattenedElement.children = childKeys;

    return [
      flattenedElement as DiagramElement,
      ...childResults,
    ];
  };

  return apiElements.flatMap((el) => flattenNode(el));
}