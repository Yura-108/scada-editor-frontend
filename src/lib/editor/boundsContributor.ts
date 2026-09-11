import type {DiagramElement} from "@/types/editorElement.type";
import type {ElementIndex} from "@/lib/editor/elementIndex";
import {getChildElements} from "@/lib/editor/elementIndex";
import {getRenderedElement} from "@/lib/getRenderedElement";

/**
 * Участвует ли элемент в рамке своей группы.
 *
 * Рамка обязана облегать то, что ВИДНО на холсте, а `getElementBounds` про видимость не
 * знает ничего — там нет ни проверки `visible`, ни отсечения нулевого габарита. Менять сам
 * модуль границ нельзя: он же обслуживает «вписать в экран», рамку выделения и направляющие,
 * и смена его семантики ради рамки группы чинила бы одно, ломая три. Поэтому отбор живёт
 * здесь и применяется только при пересчёте рамок.
 *
 * Отсекается три случая:
 *
 *  - **`visible: false`** — рендер такой элемент пропускает (`CanvasNode`). Ровно так
 *    приезжает служебный элемент импорта CONTUR (`contur_meta`) с данными листа: он молча
 *    растягивал рамку группы до начала координат, ничего при этом не рисуя.
 *  - **нулевой габарит** — у элемента `0×0` ветка по умолчанию в `getElementBounds` отдаёт
 *    `minX = maxX = abs.x`, то есть он пришпиливает угол объединения к своей точке.
 *  - **пустой контейнер** — у группы без детей расчёт границ сваливается в общую ветку и
 *    берёт её СОБСТВЕННЫЕ `w/h`, уже с её отступом. Внешняя группа добавляет свой сверху,
 *    и на каждом уровне вложенности накапливается лишнее поле.
 *
 * Линии и полигоны сюда проходят: `w/h` у них бывают нулевыми (горизонтальный отрезок), но
 * своя ветка в `getElementBounds` считает их по концам и точкам, а не по габариту.
 */

/** Типы, чьи границы считаются по точкам, а не по `w/h`. */
const POINT_BASED = new Set(["line", "curve", "polygon"]);

export function isBoundsContributor(el: DiagramElement, index: ElementIndex): boolean {
  if (el.visible === false) return false;

  if (el.type === "group") {
    // Пустая группа не рисует ничего, кроме собственной рамки, — облегать её нечем.
    return getChildElements(el.key, index).length > 0;
  }

  if (POINT_BASED.has(el.type)) return true;

  const rendered = getRenderedElement(el) as unknown as Record<string, unknown>;
  const w = Number(rendered.w) || 0;
  const h = Number(rendered.h) || 0;
  return w > 0 && h > 0;
}
