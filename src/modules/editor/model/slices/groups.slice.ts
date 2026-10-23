import {GroupElement, DiagramElement} from "@/types/editorElement.type";
import {
  elementToGroupLocal,
  GROUP_PADDING,
  layoutGroupFromBounds,
  snapshotBounds,
  unionBounds,
  resolveParentAbsolute,
} from "@/lib/groupLayout";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";
import {createUuid} from "@/shared/lib/createUuid";
import type {EditorState} from "../editorStore";
import {
  isComplex, isComponentEl, isGroup, isLeafPrimitive,
  resplitContainer,
} from "../elementTree";
import {
  syncMemberStates,
} from "../elementStates";

/**
 * Зона «Группы и компоненты» документа стора редактора: группировка и разгруппировка,
 * «Создать компонент» из группы и обратная разборка, перенос элемента в другую группу.
 * Членство (`children` / `composition`) и рамки — docs/domain/editor-model.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Код перенесён без
 * изменений.
 */
export interface GroupsSlice {
  groupSelected: () => void;
  /** Асинхронный: разбитые группы удаляются и на сервере (иначе вернутся после сейва). */
  ungroupSelected: () => Promise<void>;
  createComponentFromGroup: (groupKey: string, name?: string) => void;
  disassembleComponent: (componentKey: string) => void;
  moveElementToGroup: (elementKey: string, targetGroupKey: string) => void;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createGroupsSlice = (set: EditorSet, get: () => EditorState): GroupsSlice => ({
  groupSelected: () => {
    const {elements, selectedIds, scene} = get();
    if (selectedIds.length < 2) return;

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

    if (topLevelSelected.length < 2) return;

    const simple = topLevelSelected.filter(el => !isGroup(el) && !isComplex(el));
    const complex = topLevelSelected.filter(isComplex);
    const groups = topLevelSelected.filter(isGroup);

    if (simple.length > 0 && complex.length === 0 && groups.length === 1) {
      const targetGroup = groups[0] as GroupElement;
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

      set({
        elements: updatedElements,
        selectedIds: [targetGroup.key],
      });

      return;
    }

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

    set({
      elements: [...updatedElements, group],
      selectedIds: [newGroupId],
    });
  },
  ungroupSelected: async () => {
    const { elements, selectedIds, activeGroupKey, scene } = get();

    // 1. Находим среди выделенных элементов только группы
    const groupsToUngroup = elements.filter(
      (el) => selectedIds.includes(el.key) && el.type === "group"
    );

    // Если не выделено ни одной группы, ничего не делаем
    if (groupsToUngroup.length === 0) return;

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
        grandParentKey === String(scene?.id)
          ? scene?.id ?? null
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

    // Разбитые группы исчезают на сервере сами: состав сцены уезжает целиком в
    // `PUT`, и группы, которой в теле нет, после сохранения не будет. Раньше здесь
    // требовался явный `DELETE` — старый `POST` был upsert-ом и возвращал группу
    // обратно после следующего сохранения.
    set({
      elements: updatedElements,
      selectedIds: [...retainedSelectedIds, ...newlySelectedIds],
      // Если разбили группу, внутри которой находились — выходим из неё.
      ...(activeGroupKey && groupIdsToRemove.includes(activeGroupKey) ? {activeGroupKey: null} : {}),
    });
  },
  createComponentFromGroup: (groupKey, name) => {
    set(state => {
      const elements = state.elements;
      const group = elements.find(el => el.key === groupKey);
      if (!group || group.type !== "group") return {};

      const primitiveKeys: string[] = [];
      const componentKeys: string[] = [];
      const dissolvedGroupKeys = new Set<string>();
      // key -> накопленный сдвиг для перевода в координатное пространство компонента
      const offsetByKey = new Map<string, {dx: number; dy: number}>();
      const reparent = new Set<string>();

      // Обходим поддерево: примитивы (в т.ч. из вложенных «глупых» групп) → composition,
      // компоненты → children; обычные под-группы расформировываем, накапливая их смещение.
      const walk = (containerKey: string, dx: number, dy: number) => {
        for (const kid of elements.filter(e => e.parentKey === containerKey)) {
          if (isLeafPrimitive(kid)) {
            primitiveKeys.push(kid.key);
            offsetByKey.set(kid.key, {dx, dy});
            reparent.add(kid.key);
          } else if (isComponentEl(kid)) {
            componentKeys.push(kid.key);
            offsetByKey.set(kid.key, {dx, dy});
            reparent.add(kid.key);
          } else {
            // обычная под-группа: узел исчезает, дети поднимаются в компонент
            dissolvedGroupKeys.add(kid.key);
            walk(kid.key, dx + kid.x, dy + kid.y);
          }
        }
      };
      walk(groupKey, 0, 0);

      const shift = (el: DiagramElement): DiagramElement => {
        const off = offsetByKey.get(el.key) ?? {dx: 0, dy: 0};
        const leaf = el as import("@/types/editorElement.type").LeafElement;
        return {
          ...el,
          parentKey: groupKey,
          parentId: group.id,
          x: el.x + off.dx,
          y: el.y + off.dy,
          ...(leaf.x1 !== undefined ? {x1: leaf.x1 + off.dx} : {}),
          ...(leaf.y1 !== undefined ? {y1: leaf.y1 + off.dy} : {}),
          ...(leaf.x2 !== undefined ? {x2: leaf.x2 + off.dx} : {}),
          ...(leaf.y2 !== undefined ? {y2: leaf.y2 + off.dy} : {}),
        } as DiagramElement;
      };

      const updated = elements
        .filter(el => !dissolvedGroupKeys.has(el.key))
        .map(el => {
          if (el.key === groupKey) {
            return {
              ...el,
              isComponent: true,
              composition: primitiveKeys,
              children: componentKeys,
              label: name ?? el.label ?? "Компонент",
            } as DiagramElement;
          }
          if (reparent.has(el.key)) return shift(el);
          return el;
        });

      // Примитивы, ставшие составом компонента, получают его состояния.
      return {
        elements: syncMemberStates(updated, groupKey, [...primitiveKeys, ...componentKeys]),
        selectedIds: [groupKey],
      };
    });
  },
  disassembleComponent: (componentKey) => {
    set(state => {
      const group = state.elements.find(el => el.key === componentKey);
      if (!group || group.type !== "group") return {};

      const composition = group.composition ?? [];
      return {
        elements: state.elements.map(el =>
          el.key === componentKey
            ? ({
                ...el,
                isComponent: false,
                children: [...el.children, ...composition],
                composition: [],
              } as DiagramElement)
            : el,
        ),
      };
    });
  },
  moveElementToGroup: (elementKey, targetGroupKey) => {
    const { elements, scene } = get();
    const element = elements.find(el => el.key === elementKey);
    const targetGroup = elements.find(el => el.key === targetGroupKey);

    if (!element || !targetGroup || targetGroup.type !== "group") return;

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
      scene?.id,
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
          scene?.id,
        );
        updatedElements = resplitContainer(updatedElements, oldParentKey, oldMembers);
        updatedElements = syncMemberStates(updatedElements, oldParentKey, oldMembers);
      }
    }

    set({ elements: updatedElements });
  }
});
