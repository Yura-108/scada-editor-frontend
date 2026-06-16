import {DiagramElement, GroupElement} from "@/types/editorElement.type";
import getAbsolutePosition, {getAbsoluteRenderedPosition} from "@/lib/getAbsolutePosition";
import {getElementBounds, getElementBoundsRendered} from "@/lib/getElementBounds";
import {getRenderedElement} from "@/lib/getRenderedElement";

export const GROUP_PADDING = 24;

export type ElementBounds = ReturnType<typeof getElementBounds>;

/** Абсолютная позиция родителя группы (0,0 для корня сцены). */
export function resolveParentAbsolute(
  parentKey: string | null | undefined,
  elements: DiagramElement[],
  sceneId?: number | null,
): {x: number; y: number} {
  if (parentKey == null || parentKey === "" || parentKey === String(sceneId ?? "")) {
    return {x: 0, y: 0};
  }

  const parent = elements.find(
    (e) => e.key === parentKey || String(e.id) === String(parentKey),
  );

  if (!parent) return {x: 0, y: 0};

  return getAbsoluteRenderedPosition(parent, elements);
}

export function unionBounds(boundsList: ElementBounds[], padding = GROUP_PADDING) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of boundsList) {
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const absX = minX - padding;
  const absY = minY - padding;

  return {
    absX,
    absY,
    w: Math.max(1, maxX - minX + padding * 2),
    h: Math.max(1, maxY - minY + padding * 2),
  };
}

/** Позиционные поля, которые могут храниться в overrides и конфликтовать с группировкой. */
const POSITION_OVERRIDE_KEYS = new Set([
  "x", "y", "w", "h", "x1", "y1", "x2", "y2", "radius", "points",
]);

/** Переводит элемент в локальные координаты группы, сохраняя визуальную позицию на холсте. */
export function elementToGroupLocal(
  el: DiagramElement,
  bounds: ElementBounds & { absX1?: number; absY1?: number; absX2?: number; absY2?: number },
  groupAbsX: number,
  groupAbsY: number,
): DiagramElement {
  const rendered = getRenderedElement(el);

  // Переносим ВСЕ позиционные значения из rendered в base, чтобы ничего не потерялось.
  // rendered = {...el, ...overrides}, поэтому rendered[key] — всегда актуальное значение.
  // Это гарантирует сохранение radius, points, w, h и т.д. при очистке overrides.
  const renderedPositionBase: Partial<Record<string, unknown>> = {};
  for (const key of POSITION_OVERRIDE_KEYS) {
    const value = (rendered as unknown as Record<string, unknown>)[key];
    if (value !== undefined) renderedPositionBase[key] = value;
  }

  // Убираем позиционные overrides из states: они уже записаны в base выше.
  // Стилевые overrides (fill, stroke, opacity, …) сохраняем.
  const cleanedStates = (el.states ?? []).map((s) => ({
    ...s,
    overrides: Object.fromEntries(
      Object.entries(s.overrides ?? {}).filter(([k]) => !POSITION_OVERRIDE_KEYS.has(k)),
    ),
  }));

  // Линия: позиция кодируется через x1/y1/x2/y2 в локальном пространстве родителя.
  // bounds содержит absX1/absY1/absX2/absY2 — абсолютные мировые координаты точек.
  // Переводим их в group-local, обнуляем x/y (они у линии — «центр», не origin).
  if (el.type === "line" || rendered.type === "line") {
    const ax1 = bounds.absX1 ?? bounds.minX;
    const ay1 = bounds.absY1 ?? bounds.minY;
    const ax2 = bounds.absX2 ?? bounds.maxX;
    const ay2 = bounds.absY2 ?? bounds.maxY;

    const lx1 = ax1 - groupAbsX;
    const ly1 = ay1 - groupAbsY;
    const lx2 = ax2 - groupAbsX;
    const ly2 = ay2 - groupAbsY;

    return {
      ...el,
      ...renderedPositionBase,
      x1: lx1, y1: ly1,
      x2: lx2, y2: ly2,
      x: (lx1 + lx2) / 2,
      y: (ly1 + ly2) / 2,
      states: cleanedStates,
    };
  }

  // Все остальные типы: позиция — через x/y (origin верхнего левого угла).
  // renderedPositionBase уже содержит актуальные w, h, radius, points и т.д.
  // Поверх него ставим вычисленные group-local x/y.
  const newX = (bounds.absX ?? bounds.minX) - groupAbsX;
  const newY = (bounds.absY ?? bounds.minY) - groupAbsY;

  return {
    ...el,
    ...renderedPositionBase,
    x: newX,
    y: newY,
    states: cleanedStates,
  };
}

/**
 * Раскладывает группу и детей по заранее снятым абсолютным границам
 * (до смены parentKey), чтобы элементы не «разлетались».
 */
export function layoutGroupFromBounds(
  elements: DiagramElement[],
  groupKey: string,
  childKeys: string[],
  boundsByKey: Map<string, ElementBounds>,
  padding = GROUP_PADDING,
  sceneId?: number | null,
): DiagramElement[] {
  const group = elements.find((el) => el.key === groupKey && el.type === "group");
  if (!group || group.type !== "group") return elements;

  const boundsList = childKeys
    .map((key) => boundsByKey.get(key))
    .filter((b): b is ElementBounds => b != null);

  if (boundsList.length === 0) return elements;

  const box = unionBounds(boundsList, padding);
  const parentAbs = resolveParentAbsolute(group.parentKey, elements, sceneId);

  const childKeySet = new Set(childKeys);

  return elements.map((el) => {
    if (el.key === groupKey) {
      return {
        ...group,
        x: box.absX - parentAbs.x,
        y: box.absY - parentAbs.y,
        w: box.w,
        h: box.h,
        children: childKeys,
      } as GroupElement;
    }

    if (!childKeySet.has(el.key)) return el;

    const bounds = boundsByKey.get(el.key);
    if (!bounds) return el;

    return {
      ...elementToGroupLocal(el, bounds, box.absX, box.absY),
      parentKey: groupKey,
      parentId: group.id,
    };
  });
}

/**
 * Снимает абсолютные границы элементов в текущем состоянии дерева.
 * Использует rendered-aware позиции, чтобы корректно обрабатывать элементы,
 * которые были перемещены (позиция в state overrides, а не в base el.x/el.y).
 */
export function snapshotBounds(
  elements: DiagramElement[],
  keys: string[],
): Map<string, ElementBounds> {
  const map = new Map<string, ElementBounds>();

  for (const key of keys) {
    const el = elements.find((e) => e.key === key);
    if (el) map.set(key, getElementBoundsRendered(el, elements));
  }

  return map;
}
