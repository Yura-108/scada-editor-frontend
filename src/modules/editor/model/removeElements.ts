import {DiagramElement} from "@/types/editorElement.type";
import {getElementIndex} from "@/core/scene";
import {getDescendantKeys, recomputeAncestorBounds} from "./elementTree";

/**
 * Удаление элементов `keys` вместе со всеми потомками (children и composition, любой
 * глубины). Возвращает новый массив и набор удалённых ключей — по нему вызывающий
 * чистит выделение и активные состояния.
 */
export function removeElementsCascade(
  elements: DiagramElement[],
  keys: string[],
  sceneId: number | undefined,
): {elements: DiagramElement[]; deletedKeys: Set<string>} {
  // Каскад: удаляем выделенные + всех их потомков (children и composition, любой глубины).
  const descendantKeys = keys.flatMap(key => getDescendantKeys(key, elements));

  const idsToDelete = new Set([...keys, ...descendantKeys]);

  // Уцелевшие родители удаляемых: чистим их children/composition от висячих ключей
  // и пересчитываем рамки (иначе рамка остаётся растянутой под удалённое).
  const parentKeysToClean = new Set(
    elements
      .filter(el => idsToDelete.has(el.key) && el.parentKey && !idsToDelete.has(el.parentKey))
      .map(el => el.parentKey!)
  );

  let nextElements = elements
    .filter(el => !idsToDelete.has(el.key))
    .map(el =>
      parentKeysToClean.has(el.key)
        ? {
            ...el,
            children: el.children.filter(k => !idsToDelete.has(k)),
            composition: (el.composition ?? []).filter(k => !idsToDelete.has(k)),
          } as DiagramElement
        : el
    );

  // Уцелевшим родителям пересчитываем рамку одним проходом: точкой входа
  // берём любого их оставшегося члена (цепочка предков от него включает
  // самого родителя).
  const membersToRecompute: string[] = [];
  const survivorsIndex = getElementIndex(nextElements);
  for (const parentKey of parentKeysToClean) {
    const parent = survivorsIndex.byKey[parentKey];
    if (!parent || parent.type !== "group") continue;
    const firstMember = [...(parent.children ?? []), ...(parent.composition ?? [])][0];
    if (firstMember) membersToRecompute.push(firstMember);
  }
  if (membersToRecompute.length) {
    nextElements = recomputeAncestorBounds(nextElements, membersToRecompute, sceneId);
  }

  return {elements: nextElements, deletedKeys: idsToDelete};
}
