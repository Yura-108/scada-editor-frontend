import {DiagramElement} from "@/types/editorElement.type";
import {createUuid} from "@/lib/createUuid";
import {parseBindings} from "@/lib/parseBindings";

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

export default function transformElements(
  apiElements: ComponentDto[] = [],
  scene: { id?: number | string; key?: string } | null = null,
) {
  if (!Array.isArray(apiElements)) {
    return [];
  }

  const flattenNode = (el: ComponentDto, fallbackParentId: number | null = null, fallbackParentKey: string | null = null): DiagramElement[] => {
    // 1. Ensure every element has a truly unique key for the editor session.
    // We cannot rely on api id because it might be 0 or non-unique across different types.
    const elementKey = el.key && el.key !== "0" ? el.key : createUuid();

    // Positional keys that groups always store in BASE, never in overrides.
    // After reload they must be stripped from overrides so getRenderedElement
    // doesn't shadow the base values that recomputeAncestorBounds updates.
    const GROUP_POSITIONAL_KEYS = new Set(["x", "y", "w", "h", "x1", "y1", "x2", "y2", "radius", "points"]);
    // Структурные ключи компонента в image (не визуальные overrides).
    // events держим только на base-элементе (не в per-state overrides), иначе
    // stale-значение в overrides перекрывало бы правку и уезжало бы в сейв.
    const STRUCTURAL_KEYS = new Set(["composition", "isComponent", "events"]);

    // Сырые распарсенные image по каждому состоянию — источник для распаковки composition.
    const rawStateImages = (el.states ?? []).map(s => parseStateImage(s.image));
    const defaultStateIdx = Math.max(0, (el.states ?? []).findIndex(s => s.isDefault));
    const defaultRawImage = rawStateImages[defaultStateIdx] ?? rawStateImages[0] ?? {};
    const isComponentFlag = Boolean(defaultRawImage.isComponent);
    const compositionDescriptors: Record<string, unknown>[] = Array.isArray(defaultRawImage.composition)
      ? (defaultRawImage.composition as Record<string, unknown>[])
      : [];

    const normalizedStates = (el.states ?? []).map((state, index) => {
      const parsed = parseStateImage(state.image);
      // Структурные ключи убираем из visual overrides всегда.
      let overrides = Object.fromEntries(Object.entries(parsed).filter(([k]) => !STRUCTURAL_KEYS.has(k)));
      if (el.type === "group") {
        overrides = Object.fromEntries(Object.entries(overrides).filter(([k]) => !GROUP_POSITIONAL_KEYS.has(k)));
      }
      return {
        id: state.id != null ? String(state.id) : createUuid(),
        name: state.name,
        overrides,
        isDefault: state.isDefault ?? index === 0,
      };
    });

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
    const resolvedParentKey = fallbackParentKey ?? (scene?.key ?? String(scene?.id ?? ""));

    // Распаковка запечённых примитивов composition в плоские элементы редактора.
    const compositionKeys: string[] = [];
    const compositionElements: DiagramElement[] = [];

    compositionDescriptors.forEach((desc, i) => {
      const primKey = typeof desc.key === "string" && desc.key ? desc.key : createUuid();
      const primType = String(desc.type ?? "rectangle");

      // Состояния примитива восстанавливаем из composition[i] каждого состояния контейнера.
      const primStates = (el.states ?? []).map((cs, ci) => {
        const rawImg = rawStateImages[ci] ?? {};
        const compArr = Array.isArray(rawImg.composition) ? (rawImg.composition as Record<string, unknown>[]) : [];
        const d = compArr[i] ?? desc;
        // scripts/bindings/properties/events — данные примитива, не визуальные overrides.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { type: _t, key: _k, scripts: _s, bindings: _b, properties: _p, events: _e, ...overrides } = d;
        return {
          id: createUuid(),
          name: cs.name,
          overrides,
          isDefault: cs.isDefault ?? ci === 0,
        };
      });

      const primDefault = primStates.find(s => s.isDefault) ?? primStates[0];
      const primOverrides = (primDefault?.overrides ?? {}) as Record<string, unknown>;

      compositionElements.push({
        id: null,
        key: primKey,
        type: primType,
        x: toFiniteNumber(primOverrides.x, 0),
        y: toFiniteNumber(primOverrides.y, 0),
        w: toFiniteNumber(primOverrides.w, 80),
        h: toFiniteNumber(primOverrides.h, 80),
        composition: [],
        ...primOverrides,
        states: primStates.length
          ? primStates
          : [{ id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true }],
        parentId: null,
        parentKey: elementKey,
        children: [],
        // Данные примитива (теги/скрипты/биндинги) восстанавливаем из дескриптора —
        // buildShapeDescriptor запекает их при сохранении (симметрия round-trip).
        scripts: normalizeArray(desc.scripts as Record<string, unknown>[]).map((s) => ({
          id: s.id != null ? String(s.id) : createUuid(),
          name: String(s.name ?? ""),
          content: String(s.content ?? s.script ?? ""),
        })),
        // Composition-дескриптор хранит TagBinding[] сырыми объектами; parseBindings
        // заодно отсеивает легаси-мусор (симметрия с buildShapeDescriptor).
        bindings: parseBindings(desc.bindings),
        properties: normalizeArray(desc.properties as unknown[]) as DiagramElement["properties"],
        ...(desc.events ? {events: desc.events as DiagramElement["events"]} : {}),
        label: String(desc.label ?? ""),
      } as DiagramElement);

      compositionKeys.push(primKey);
    });

    const flattenedElement = {
      id: el.id,
      key: elementKey,
      type: el.type,
      // Базовые координаты берём из НЕобрезанного image (для групп/компонентов overrides очищены).
      x: toFiniteNumber(defaultRawImage.x, 0),
      y: toFiniteNumber(defaultRawImage.y, 0),
      w: toFiniteNumber(defaultRawImage.w, 80),
      h: toFiniteNumber(defaultRawImage.h, 80),
      ...(image || {}),
      // events восстанавливаем из НЕобрезанного image (в overrides их нет — см. STRUCTURAL_KEYS).
      ...(defaultRawImage.events ? {events: defaultRawImage.events as DiagramElement["events"]} : {}),
      composition: compositionKeys,
      isComponent: isComponentFlag,
      states: normalizedStates,
      parentId: resolvedParentId,
      parentKey: resolvedParentKey,
      children: [], // Will be populated by children's processing
      scripts: normalizeArray(el.scripts).map((s: Record<string, unknown>) => ({
        id: s.id != null ? String(s.id) : createUuid(),
        name: String(s.name ?? ""),
        content: String(s.content ?? s.script ?? ""),
      })),
      // Top-level биндинги едут через DTO-обёртку {name, script: JSON} — распаковываем.
      bindings: parseBindings(el.bindings),
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
      ...compositionElements,
      ...childResults,
    ];
  };

  return apiElements.flatMap((el) => flattenNode(el));
}