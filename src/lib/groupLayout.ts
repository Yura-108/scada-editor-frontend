import {DiagramElement, GroupElement} from "@/types/editorElement.type";
import {absolutePosition} from "@/lib/getAbsolutePosition";
import {getElementBounds, getElementBoundsRendered} from "@/lib/getElementBounds";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {ElementIndex, getElementIndex, resolveParentElement} from "@/lib/editor/elementIndex";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";

export const GROUP_PADDING = 20;

export type ElementBounds = ReturnType<typeof getElementBounds>;

/** Абсолютная позиция родителя группы (0,0 для корня сцены). */
export function resolveParentAbsolute(
  parentKey: string | null | undefined,
  elements: DiagramElement[],
  sceneId?: number | null,
): {x: number; y: number} {
  return resolveParentAbsoluteIndexed(parentKey, getElementIndex(elements), sceneId);
}

/** То же поверх готового индекса — для горячих путей, где индекс уже построен. */
export function resolveParentAbsoluteIndexed(
  parentKey: string | null | undefined,
  index: ElementIndex,
  sceneId?: number | null,
): {x: number; y: number} {
  if (parentKey == null || parentKey === "" || parentKey === String(sceneId ?? "")) {
    return {x: 0, y: 0};
  }

  const parent = resolveParentElement(parentKey, index);
  if (!parent) return {x: 0, y: 0};

  return absolutePosition(parent, index, true);
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

/**
 * Переводит элемент в локальные координаты группы, сохраняя визуальную позицию на холсте.
 *
 * Перенос между двумя системами координат — это СДВИГ на постоянную величину, поэтому
 * достаточно подвинуть позиционные поля и в базе, и в overrides каждого состояния
 * (`shiftElementPositions`). Раньше функция собирала новую позицию из `bounds` и при этом
 * ВЫЧИЩАЛА позиционные overrides у всех состояний — «схлопывала» их в то состояние, что
 * было на экране. Из-за этого добавление одной подписи в компонент с четырьмя состояниями
 * молча уничтожало всю пер-состоянийную геометрию: индикатор, который в «Аварии» стоял
 * иначе, чем в «Норме», переезжал в общую позицию без возможности вернуть.
 *
 * Отдельная ветка для линии не нужна: равномерный сдвиг `x/y/x1/y1/x2/y2` сохраняет мировое
 * положение концов. Мировая точка конца — `abs.x − rendered.x + rendered.x1`
 * (см. `elementBoundsRendered`), а сдвиг меняет `abs.x` и `rendered.x` на одну величину.
 */
export function elementToGroupLocal(
  el: DiagramElement,
  bounds: ElementBounds,
  groupAbsX: number,
  groupAbsY: number,
): DiagramElement {
  const rendered = getRenderedElement(el);

  // Абсолютный origin СТАРОГО родителя = абсолютный origin элемента − его локальная позиция.
  // `bounds.absX` — именно origin, а не габарит (контракт см. у ElementBounds).
  const parentAbsX = (bounds.absX ?? bounds.minX) - (rendered.x ?? 0);
  const parentAbsY = (bounds.absY ?? bounds.minY) - (rendered.y ?? 0);

  return shiftElementPositions(el, parentAbsX - groupAbsX, parentAbsY - groupAbsY);
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
