import {DiagramElement, GroupElement} from "@/types/editorElement.type";
import getAbsolutePosition from "@/lib/getAbsolutePosition";
import {getElementBounds} from "@/lib/getElementBounds";
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

  return getAbsolutePosition(parent, elements);
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

/** Переводит элемент в локальные координаты группы, сохраняя визуальную позицию на холсте. */
export function elementToGroupLocal(
  el: DiagramElement,
  bounds: ElementBounds,
  groupAbsX: number,
  groupAbsY: number,
): DiagramElement {
  const rendered = getRenderedElement(el);

  return {
    ...el,

    // абсолютная позиция элемента -> локальная позиция внутри группы
    x: (bounds.absX ?? bounds.minX) - groupAbsX,
    y: (bounds.absY ?? bounds.minY) - groupAbsY,

    // размеры сохраняем как есть
    w: rendered.w ?? el.w ?? 0,
    h: rendered.h ?? el.h ?? 0,
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

/** Снимает абсолютные границы элементов в текущем состоянии дерева. */
export function snapshotBounds(
  elements: DiagramElement[],
  keys: string[],
): Map<string, ElementBounds> {
  const map = new Map<string, ElementBounds>();

  for (const key of keys) {
    const el = elements.find((e) => e.key === key);
    if (el) map.set(key, getElementBounds(el, elements));
  }

  return map;
}
