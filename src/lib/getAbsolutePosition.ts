import {DiagramElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {ElementIndex, getElementIndex, resolveParentElement} from "@/lib/editor/elementIndex";

/**
 * Абсолютные координаты элемента на холсте (с учётом цепочки parentKey).
 *
 * Цепочка родителей разворачивается через индекс: раньше на каждый уровень
 * вложенности шёл `elements.find` по всему массиву.
 */
export default function getAbsolutePosition(
  el: DiagramElement,
  elements: DiagramElement[],
): {x: number; y: number} {
  return absolutePosition(el, getElementIndex(elements), false);
}

/**
 * Rendered-aware version: uses getRenderedElement(el).x/y (includes state overrides)
 * at every level of the parent chain. Use this wherever actual visual position matters,
 * e.g. when taking a snapshot before grouping/ungrouping.
 */
export function getAbsoluteRenderedPosition(
  el: DiagramElement,
  elements: DiagramElement[],
): {x: number; y: number} {
  return absolutePosition(el, getElementIndex(elements), true);
}

/** Общая реализация обоих вариантов поверх готового индекса. */
export function absolutePosition(
  el: DiagramElement,
  index: ElementIndex,
  rendered: boolean,
): {x: number; y: number} {
  let x = 0;
  let y = 0;
  let current: DiagramElement | null = el;
  // Страховка от цикла в parentKey: без неё битая иерархия вешала бы вкладку.
  let hops = 0;

  while (current && hops++ < 1000) {
    const source: DiagramElement = rendered ? getRenderedElement(current) : current;
    x += source.x ?? 0;
    y += source.y ?? 0;
    current = resolveParentElement(current.parentKey, index);
  }

  return {x, y};
}
