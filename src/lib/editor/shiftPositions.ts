import {DiagramElement} from "@/types/editorElement.type";

/**
 * Сдвиг позиционных полей — один на весь редактор.
 *
 * Позиция элемента живёт в двух местах сразу: базовые поля элемента и `overrides`
 * КАЖДОГО его состояния (`updateElementVisual` пишет живую позиция листа именно в
 * overrides текущего состояния). У линии она вдобавок закодирована концами
 * `x1/y1/x2/y2`, а не `x/y`. Поэтому любой перенос — разгруппировка, вступление в
 * группу, вставка со смещением — обязан сдвигать всё это разом: правка одних только
 * базовых `x/y` телепортирует лист, чья актуальная позиция лежит в overrides, и
 * схлопывает состояния, у которых геометрия своя.
 */

/** Сдвигает все позиционные поля (x, y, x1, y1, x2, y2) объекта на dx/dy. */
export const shiftPositionKeys = (
  obj: Record<string, unknown>,
  dx: number,
  dy: number,
): Record<string, unknown> => {
  const o = {...obj};
  for (const k of ['x', 'x1', 'x2'] as const) {
    if (typeof o[k] === 'number') o[k] = (o[k] as number) + dx;
  }
  for (const k of ['y', 'y1', 'y2'] as const) {
    if (typeof o[k] === 'number') o[k] = (o[k] as number) + dy;
  }
  return o;
};

/** Сдвигает элемент на dx/dy: базовые поля + позиционные ключи в overrides всех состояний. */
export const shiftElementPositions = (el: DiagramElement, dx: number, dy: number): DiagramElement => {
  const shifted = shiftPositionKeys(el as unknown as Record<string, unknown>, dx, dy) as unknown as DiagramElement;
  shifted.states = (el.states ?? []).map(s => ({
    ...s,
    overrides: shiftPositionKeys(s.overrides ?? {}, dx, dy),
  }));
  return shifted;
};
