import { DiagramElement } from "@/types/editorElement.type";

/**
 * Порядок отрисовки по `zIndex` — единственное место, где живёт это правило.
 *
 * Порядок считается **в пределах контейнера**: сортируются только соседи (элементы
 * с общим `parentKey`), как в CSS — вложенный элемент не может перекрыть чужого
 * родителя. Отсутствующий `zIndex` равен нулю, а сортировка стабильная, поэтому у
 * схем без единого проставленного слоя порядок остаётся ровно прежним — порядком
 * массива `elements` и порядком `composition`+`children` родителя.
 */

/** Слой элемента: отсутствующее или нечисловое значение — ноль. */
export const zIndexOf = (el: DiagramElement | undefined): number =>
  typeof el?.zIndex === "number" && Number.isFinite(el.zIndex) ? el.zIndex : 0;

/** Элементы в порядке отрисовки (копия, исходный массив не мутируется). */
export function sortByZIndex<T extends DiagramElement>(list: T[]): T[] {
  return [...list].sort((a, b) => zIndexOf(a) - zIndexOf(b));
}

/** То же для списка ключей — состав контейнера, элементы берём из ElementIndex.byKey. */
export function sortKeysByZIndex(
  keys: string[],
  byKey: Record<string, DiagramElement>,
): string[] {
  return [...keys].sort((a, b) => zIndexOf(byKey[a]) - zIndexOf(byKey[b]));
}
