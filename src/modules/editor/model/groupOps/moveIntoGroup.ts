import {DiagramElement, GroupElement} from "@/types/editorElement.type";
import {GROUP_PADDING, layoutGroupFromBounds, snapshotBounds} from "@/core/scene";
import {resplitContainer} from "../elementTree";
import {syncMemberStates} from "../elementStates";

/**
 * «Переместить в группу»: элемент уходит из старого контейнера в `targetGroupKey`.
 * Рамки и роли членов пересчитываются у обоих контейнеров, новые члены получают
 * состояния контейнера. `null` — нет элемента или цель не группа.
 */
export function moveIntoGroup(
  elements: DiagramElement[],
  elementKey: string,
  targetGroupKey: string,
  sceneId: number | undefined,
): DiagramElement[] | null {
  const element = elements.find(el => el.key === elementKey);
  const targetGroup = elements.find(el => el.key === targetGroupKey);

  if (!element || !targetGroup || targetGroup.type !== "group") return null;

  const oldParentKey = element.parentKey;

  // Полный состав целевого контейнера + перемещаемый — для расчёта рамки.
  const targetMemberKeys = [
    ...new Set([
      ...(targetGroup.children ?? []),
      ...(targetGroup.composition ?? []),
      elementKey,
    ]),
  ];
  const targetBoundsByKey = snapshotBounds(elements, targetMemberKeys);

  // Убираем перемещаемый из ОБОИХ списков старого родителя.
  let updatedElements = elements.map(el => {
    if (el.key === oldParentKey && el.type === "group" && oldParentKey !== targetGroupKey) {
      return {
        ...el,
        children: el.children.filter(k => k !== elementKey),
        composition: (el.composition ?? []).filter(k => k !== elementKey),
      } as DiagramElement;
    }
    return el;
  });

  updatedElements = layoutGroupFromBounds(
    updatedElements,
    targetGroupKey,
    targetMemberKeys,
    targetBoundsByKey,
    GROUP_PADDING,
    sceneId,
  );

  // layoutGroupFromBounds сложил все ключи в children — переразбиваем по роли.
  updatedElements = resplitContainer(updatedElements, targetGroupKey, targetMemberKeys);
  updatedElements = syncMemberStates(updatedElements, targetGroupKey, targetMemberKeys);

  if (oldParentKey && oldParentKey !== targetGroupKey) {
    const oldGroup = updatedElements.find(
      el => el.key === oldParentKey && el.type === "group",
    ) as GroupElement | undefined;

    const oldMembers = oldGroup
      ? [...oldGroup.children, ...(oldGroup.composition ?? [])]
      : [];

    if (oldMembers.length) {
      const oldBoundsByKey = snapshotBounds(updatedElements, oldMembers);
      updatedElements = layoutGroupFromBounds(
        updatedElements,
        oldParentKey,
        oldMembers,
        oldBoundsByKey,
        GROUP_PADDING,
        sceneId,
      );
      updatedElements = resplitContainer(updatedElements, oldParentKey, oldMembers);
      updatedElements = syncMemberStates(updatedElements, oldParentKey, oldMembers);
    }
  }

  return updatedElements;
}
