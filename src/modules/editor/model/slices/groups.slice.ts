import {GroupElement, DiagramElement} from "@/types/editorElement.type";
import {
  GROUP_PADDING,
  layoutGroupFromBounds,
  snapshotBounds,
} from "@/lib/groupLayout";
import type {EditorState} from "../editorStore";
import {
  isComponentEl, isLeafPrimitive,
  resplitContainer,
} from "../elementTree";
import {
  syncMemberStates,
} from "../elementStates";
import {groupElements} from "../groupOps/groupElements";
import {ungroupElements} from "../groupOps/ungroupElements";

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
    const result = groupElements(elements, selectedIds, scene);
    if (result) set(result);
  },
  ungroupSelected: async () => {
    const {elements, selectedIds, activeGroupKey, scene} = get();
    const result = ungroupElements(elements, selectedIds, scene?.id);
    if (!result) return;

    // Разбитые группы исчезают на сервере сами: состав сцены уезжает целиком в
    // `PUT`, и группы, которой в теле нет, после сохранения не будет. Раньше здесь
    // требовался явный `DELETE` — старый `POST` был upsert-ом и возвращал группу
    // обратно после следующего сохранения.
    set({
      elements: result.elements,
      selectedIds: result.selectedIds,
      // Если разбили группу, внутри которой находились — выходим из неё.
      ...(activeGroupKey && result.removedKeys.includes(activeGroupKey) ? {activeGroupKey: null} : {}),
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
