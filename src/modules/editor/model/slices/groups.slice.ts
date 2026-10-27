import {DiagramElement} from "@/types/editorElement.type";
import type {EditorState} from "../editorStore";
import {groupElements} from "../groupOps/groupElements";
import {ungroupElements} from "../groupOps/ungroupElements";
import {componentFromGroup} from "../groupOps/componentFromGroup";
import {moveIntoGroup} from "../groupOps/moveIntoGroup";

/**
 * Зона «Группы и компоненты» документа стора редактора: группировка и разгруппировка,
 * «Создать компонент» из группы и обратная разборка, перенос элемента в другую группу.
 * Членство (`children` / `composition`) и рамки — docs/domain/editor-model.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6). Расчёты над массивом
 * `elements` — чистые функции в `model/groupOps/`, здесь только запись в стор.
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
    set(state => componentFromGroup(state.elements, groupKey, name) ?? {});
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
    const {elements, scene} = get();
    const next = moveIntoGroup(elements, elementKey, targetGroupKey, scene?.id);
    if (next) set({elements: next});
  }
});
