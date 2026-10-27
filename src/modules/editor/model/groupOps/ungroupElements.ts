import {DiagramElement} from "@/types/editorElement.type";
import {shiftElementPositions} from "@/core/scene";
import {isComponentEl, resplitContainer} from "../elementTree";
import {syncMemberStates} from "../elementStates";

export interface UngroupResult {
  elements: DiagramElement[];
  selectedIds: string[];
  /** Ключи разбитых групп — по ним вызывающий выходит из группы, в которой стоял. */
  removedKeys: string[];
}

/**
 * Разгруппировка выделенных групп: члены переходят к родителю группы («дедушке») с
 * сохранением абсолютной позиции, сама группа исчезает. В выделении остаются бывшие
 * члены и выделенные вместе с группами обычные фигуры. `null` — групп в выделении нет.
 */
export function ungroupElements(
  elements: DiagramElement[],
  selectedIds: string[],
  sceneId: number | undefined,
): UngroupResult | null {
  // 1. Находим среди выделенных элементов только группы
  const groupsToUngroup = elements.filter(
    (el) => selectedIds.includes(el.key) && el.type === "group"
  );

  // Если не выделено ни одной группы, ничего не делаем
  if (groupsToUngroup.length === 0) return null;

  const groupIdsToRemove = groupsToUngroup.map((g) => g.key);

  // Здесь мы соберем ID элементов, которые освободятся из-под групп,
  // чтобы автоматически сделать их выделенными после разгруппировки
  const newlySelectedIds: string[] = [];

  // Работаем с копией массива элементов
  let updatedElements = [...elements];

  // Проходимся по каждой группе, которую нужно разбить
  groupsToUngroup.forEach((group) => {
    const {
      key: groupId,
      x: groupX,
      y: groupY,
      parentKey: grandParentKey,
    } = group;

    // Члены группы — и children (компоненты/узлы), и composition (примитивы компонента).
    const memberKeys = [...(group.children ?? []), ...(group.composition ?? [])];
    newlySelectedIds.push(...memberKeys);

    // parentId «дедушки»: корень сцены → id сцены, группа → её серверный id
    // (null, если она ещё не сохранена — бэкенд свяжет по parent_key).
    const grandParentId =
      grandParentKey === String(sceneId)
        ? sceneId ?? null
        : (updatedElements.find((el) => el.key === grandParentKey)?.id ?? null);

    // Шаг А: Обновляем ВСЕХ членов разбиваемой группы (по parentKey — покрывает
    // и children, и composition). Прибавляем координаты исчезающей группы, причём
    // сдвигаем и базовые поля, и позиционные ключи в overrides состояний:
    // у перемещённого внутри группы листа актуальная позиция живёт в overrides,
    // и сдвиг только базового x/y «телепортирует» его на старое место.
    // parentId переписываем вместе с parentKey: иначе в нём остаётся серверный id
    // удалённой группы, и сохранение падает с 400 «Component not found».
    updatedElements = updatedElements.map((el) => {
      if (el.parentKey === groupId) {
        return {
          ...shiftElementPositions(el, groupX, groupY),
          // Член переходит под крыло "дедушки" (если группа сама была внутри группы)
          parentKey: grandParentKey,
          parentId: grandParentId,
        };
      }
      return el;
    });

    // Шаг Б: Если удаляемая группа лежала ВНУТРИ другой группы ("дедушки") —
    // вливаем членов в прародителя с учётом роли (примитивы → composition,
    // компоненты → children), иначе примитивы-члены осиротеют.
    if (grandParentKey) {
      const grandParent = updatedElements.find(
        (el) => el.key === grandParentKey && el.type === "group",
      );
      if (grandParent) {
        const mergedMemberKeys = [
          ...grandParent.children.filter((key) => key !== groupId),
          ...(grandParent.composition ?? []).filter((key) => key !== groupId),
          ...memberKeys,
        ];
        if (isComponentEl(grandParent)) {
          updatedElements = resplitContainer(updatedElements, grandParentKey, mergedMemberKeys);
          updatedElements = syncMemberStates(updatedElements, grandParentKey, memberKeys);
        } else {
          // «Глупая» группа держит всё в children.
          updatedElements = updatedElements.map((el) =>
            el.key === grandParentKey
              ? {...el, children: mergedMemberKeys, composition: []}
              : el,
          );
        }
      }
    }
  });

  // 2. Окончательно удаляем сами разбитые группы из массива
  updatedElements = updatedElements.filter((el) => !groupIdsToRemove.includes(el.key));

  // 3. Сохраняем в выделении обычные фигуры, которые были выделены вместе с группами
  const retainedSelectedIds = selectedIds.filter((id) => !groupIdsToRemove.includes(id));

  return {
    elements: updatedElements,
    selectedIds: [...retainedSelectedIds, ...newlySelectedIds],
    removedKeys: groupIdsToRemove,
  };
}
