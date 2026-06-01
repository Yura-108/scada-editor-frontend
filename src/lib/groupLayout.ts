import {DiagramElement, GroupElement} from "@/types/editorElement.type";
import getAbsolutePosition from "@/lib/getAbsolutePosition";
import {getElementBounds} from "@/lib/getElementBounds";
import {getRenderedElement} from "@/lib/getRenderedElement";

export const GROUP_PADDING = 24;

const getDirectChildren = (groupKey: string, elements: DiagramElement[]) =>
  elements.filter((el) => String(el.parentKey) === String(groupKey));

/** Подгоняет позицию и размер группы под фактические границы дочерних элементов. */
export function fitGroupToChildren(
  elements: DiagramElement[],
  groupKey: string,
  padding = GROUP_PADDING,
): DiagramElement[] {
  const group = elements.find((el) => el.key === groupKey && el.type === "group");
  if (!group || group.type !== "group") return elements;

  const children = getDirectChildren(groupKey, elements);
  if (children.length === 0) return elements;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const bounds = getElementBounds(child, elements);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (!Number.isFinite(minX)) return elements;

  const newGroupAbsX = minX - padding;
  const newGroupAbsY = minY - padding;
  const newW = Math.max(1, maxX - minX + padding * 2);
  const newH = Math.max(1, maxY - minY + padding * 2);

  const parentAbs = getParentAbsolutePositionForGroup(group, elements);

  const childKeys = new Set(children.map((c) => c.key));

  return elements.map((el) => {
    if (el.key === groupKey) {
      return {
        ...group,
        x: newGroupAbsX - parentAbs.x,
        y: newGroupAbsY - parentAbs.y,
        w: newW,
        h: newH,
      } as GroupElement;
    }

    if (!childKeys.has(el.key)) return el;

    // For vector elements, we want to maintain their absolute coordinates
    // relative to the new group origin.
    const bounds = getElementBounds(el, elements);

    // Correct the absolute coordinates to be relative to the new group position
    const relX = bounds.minX - newGroupAbsX;
    const relY = bounds.minY - newGroupAbsY;

    if (el.type === "line") {
      return {
        ...el,
        x: relX,
        y: relY,
        x1: bounds.absX1! - newGroupAbsX,
        y1: bounds.absY1! - newGroupAbsY,
        x2: bounds.absX2! - newGroupAbsX,
        y2: bounds.absY2! - newGroupAbsY,
      };
    }

    const rendered = getRenderedElement(el);

    return {
      ...el,
      x: relX,
      y: relY,
      w: rendered.w ?? 0,
      h: rendered.h ?? 0,
    };
  });
}

function getParentAbsolutePositionForGroup(
  group: DiagramElement,
  elements: DiagramElement[],
) {
  const parentKey = group.parentKey;
  if (parentKey == null || parentKey === "") return {x: 0, y: 0};

  const parent = elements.find(
    (e) => e.key === parentKey || String(e.id) === String(parentKey),
  );

  if (!parent) return {x: 0, y: 0};

  return getAbsolutePosition(parent, elements);
}
