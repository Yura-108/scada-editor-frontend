import {DiagramElement, GroupElement, SceneType} from "@/types/editorElement.type";
import {
  elementToGroupLocal,
  GROUP_PADDING,
  layoutGroupFromBounds,
  snapshotBounds,
  unionBounds,
  resolveParentAbsolute,
} from "@/lib/groupLayout";
import {createUuid} from "@/shared/lib/createUuid";
import {isComplex, isComponentEl, isGroup, resplitContainer} from "../elementTree";
import {syncMemberStates} from "../elementStates";

export interface GroupResult {
  elements: DiagramElement[];
  selectedIds: string[];
}

/**
 * Группировка выделенного. Два случая:
 *  - простые элементы плюс ровно одна группа — элементы входят в эту группу;
 *  - иначе — новая группа «Group (N)» на месте выделенных.
 *
 * Возвращает новый массив и выделение (сама группа) или `null`, если группировать нечего.
 */
export function groupElements(
  elements: DiagramElement[],
  selectedIds: string[],
  scene: SceneType | null,
): GroupResult | null {
  if (selectedIds.length < 2) return null;

  const topLevelSelected = elements
    .filter(el => selectedIds.includes(el.key))
    .filter(el => {
      let parentKey: string | null | undefined = el.parentKey;

      while (parentKey) {
        if (selectedIds.includes(parentKey)) return false;
        parentKey = elements.find(e => e.key === parentKey)?.parentKey;
      }

      return true;
    }) as DiagramElement[];

  if (topLevelSelected.length < 2) return null;

  const simple = topLevelSelected.filter(el => !isGroup(el) && !isComplex(el));
  const complex = topLevelSelected.filter(isComplex);
  const groups = topLevelSelected.filter(isGroup);

  if (simple.length > 0 && complex.length === 0 && groups.length === 1) {
    return addToExistingGroup(elements, groups[0] as GroupElement, simple, scene);
  }

  return wrapInNewGroup(elements, topLevelSelected, scene);
}

/** Простые элементы входят в единственную выделенную группу. */
function addToExistingGroup(
  elements: DiagramElement[],
  targetGroup: GroupElement,
  simple: DiagramElement[],
  scene: SceneType | null,
): GroupResult {
  const simpleKeys = simple.map(s => s.key);
  // ВАЖНО: включаем composition (запечённые примитивы компонента) в состав —
  // иначе рамка считается без них, а их локальные координаты не компенсируются
  // при сдвиге origin группы.
  const allMemberKeys = [
    ...new Set([
      ...(targetGroup.children ?? []),
      ...(targetGroup.composition ?? []),
      ...simpleKeys,
    ]),
  ];

  const boundsByKey = snapshotBounds(elements, allMemberKeys);

  let updatedElements = layoutGroupFromBounds(
    elements,
    targetGroup.key,
    allMemberKeys,
    boundsByKey,
    GROUP_PADDING,
    scene?.id,
  );

  // layoutGroupFromBounds кладёт ВСЕХ членов в children. Для компонента
  // переразбиваем состав по роли: примитивы → composition, компоненты → children,
  // иначе примитивы сериализуются как вложенные компоненты (порча данных).
  if (isComponentEl(targetGroup)) {
    updatedElements = resplitContainer(updatedElements, targetGroup.key, allMemberKeys);
  }

  // Новые члены получают весь набор состояний контейнера — иначе панель
  // «Состояния» показывает у них одно состояние против четырёх у компонента.
  updatedElements = syncMemberStates(updatedElements, targetGroup.key, allMemberKeys);

  return {elements: updatedElements, selectedIds: [targetGroup.key]};
}

/** Новая группа вокруг выделенных элементов верхнего уровня. */
function wrapInNewGroup(
  elements: DiagramElement[],
  topLevelSelected: DiagramElement[],
  scene: SceneType | null,
): GroupResult {
  const newGroupId = createUuid();
  const selectedKeys = topLevelSelected.map(el => el.key);
  const parentKeys = [...new Set(topLevelSelected.map(el => el.parentKey).filter(Boolean))];
  // Без сцены фолбэк — null (а не литерал "undefined" от String(undefined)).
  const commonParentKey = parentKeys.length === 1 ? parentKeys[0] : (scene ? String(scene.id) : null);
  const commonParentElement = commonParentKey
    ? elements.find(el => el.key === commonParentKey && el.type === "group") as GroupElement | undefined
    : undefined;
  const newGroupParentId = commonParentKey === String(scene?.id)
    ? scene?.id || null
    : commonParentElement?.id ?? null;

  const boundsByKey = snapshotBounds(elements, selectedKeys);
  const box = unionBounds([...boundsByKey.values()], GROUP_PADDING);
  const parentAbs = resolveParentAbsolute(commonParentKey, elements, scene?.id);

  let updatedElements = elements.map(el => {
    if (!selectedKeys.includes(el.key)) return el;

    const bounds = boundsByKey.get(el.key)!;
    return {
      ...elementToGroupLocal(el, bounds, box.absX, box.absY),
      parentKey: newGroupId,
      parentId: null,
    };
  });

  if (commonParentElement) {
    updatedElements = updatedElements.map(el => {
      if (el.key !== commonParentElement.key) return el;

      const nextChildren = el.children.filter(childKey => !selectedKeys.includes(childKey));
      const insertIndex = el.children.findIndex(childKey => selectedKeys.includes(childKey));

      if (insertIndex >= 0) {
        nextChildren.splice(insertIndex, 0, newGroupId);
      } else {
        nextChildren.push(newGroupId);
      }

      return {...el, children: nextChildren};
    });
  }

  const group: GroupElement = {
    id: null,
    key: newGroupId,
    type: "group",
    x: box.absX - parentAbs.x,
    y: box.absY - parentAbs.y,
    w: box.w,
    h: box.h,
    composition: [],
    children: selectedKeys,
    parentId: newGroupParentId,
    parentKey: commonParentKey,
    label: `Group (${topLevelSelected.length})`,
    bg: "rgba(59,130,246,0.08)",
    borderStyle: "dashed",
    borderColor: "#3b82f6",
    scripts: [],
    bindings: [],
    properties: [],
    states: [{
      id: createUuid(),
      name: "Нормальное",
      overrides: {},
      isDefault: true,
    }],
  };

  return {elements: [...updatedElements, group], selectedIds: [newGroupId]};
}
