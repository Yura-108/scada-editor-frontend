import {create} from "zustand/react";
import {temporal} from "zundo";
import type {EditorProject} from "@/lib/pickProjectsFromComponents";
import {bindEditorStore} from "./editorStoreRef";
import {bindActiveStateReader} from "@/core/scene";
import {bindSceneViewStore} from "@/core/canvas";
import {editorSession} from "./editorSession";
import {createCameraSlice, type CameraSlice} from "./slices/camera.slice";
import {createSelectionSlice, type SelectionSlice} from "./slices/selection.slice";
import {createSaveSlice, type SaveSlice} from "./slices/save.slice";
import {createVersionsSlice, type VersionsSlice} from "./slices/versions.slice";
import {createProjectsSlice, type ProjectsSlice} from "./slices/projects.slice";
import {createScenesSlice, type ScenesSlice} from "./slices/scenes.slice";
import {createLayoutSlice, type LayoutSlice} from "./slices/layout.slice";
import {createStatesSlice, type StatesSlice} from "./slices/states.slice";
import {createPropertiesSlice, type PropertiesSlice} from "./slices/properties.slice";
import {createElementsSlice, type ElementsSlice} from "./slices/elements.slice";
import {createClipboardSlice, type ClipboardSlice} from "./slices/clipboard.slice";
import {createGroupsSlice, type GroupsSlice} from "./slices/groups.slice";

export type {EditorProject};

// Стор режется на слайсы по зонам (docs/architecture.md, шаг 6); поля слайса описаны в его файле.
export type EditorState = CameraSlice & SelectionSlice & SaveSlice & VersionsSlice & ProjectsSlice & ScenesSlice
  & LayoutSlice & StatesSlice & PropertiesSlice & ElementsSlice & ClipboardSlice & GroupsSlice & {
  // removeElements: (ids: string[]) => void;
}

export const useEditorStore = create<EditorState>()(temporal(
    (set, get) => ({
      ...createCameraSlice(set, get),
      ...createSelectionSlice(set, get),
      ...createSaveSlice(set, get),
      ...createVersionsSlice(set, get),
      ...createProjectsSlice(set, get),
      ...createScenesSlice(set, get),
      ...createLayoutSlice(set, get),
      ...createStatesSlice(set, get),
      ...createPropertiesSlice(set, get),
      ...createElementsSlice(set, get),
      ...createClipboardSlice(set, get),
      ...createGroupsSlice(set, get),

    }),
    {
      limit: 50,
      partialize: (state) => ({
        elements: state.elements,
      }),
      // Пишем в историю ТОЛЬКО когда реально изменился массив elements.
      // Иначе zundo фиксирует снапшот на каждый set() (камера/зум/пан, выделение и т.п.)
      // и стек заполняется «пустыми» дублями — Ctrl+Z приходится жать много раз.
      // Все мутации элементов создают новый массив, поэтому сравнения по ссылке достаточно.
      equality: (a, b) => a.elements === b.elements,
    }
  )
);

// Общие хелперы (editorStoreInternals) берут стор отсюда — импортировать его сами не могут.
bindEditorStore(useEditorStore);
// getRenderedElement (core/scene) читает активные состояния элементов через эту регистрацию.
bindActiveStateReader(() => useEditorStore.getState().currentComponentStateByElementKey);
// Холст (core/canvas) подписывается на сцену через эту регистрацию — тем же стором.
bindSceneViewStore(useEditorStore);

/**
 * Подчищает выделение, когда выделенных элементов больше нет в `elements`.
 *
 * История undo хранит только `elements` (см. partialize), поэтому отмена вставки
 * или дублирования возвращает массив элементов, а `selectedIds` остаются ключами
 * уже несуществующих копий: панель свойств пустела, а кнопки группировки в
 * ToolsPanel оставались активными (они смотрят на `selectedIds.length`).
 *
 * Сам `set` историю не пишет: `equality` сравнивает ссылку на `elements`, а она
 * здесь не меняется.
 */
useEditorStore.subscribe((state, prev) => {
  if (state.elements === prev.elements) return;

  // Флаг «есть несохранённые изменения» — здесь же, чтобы не заводить второй
  // подписчик на тот же самый сигнал.
  const dirty = state.elements !== editorSession.savedElementsSnapshot;
  if (dirty !== state.isDirty) useEditorStore.setState({isDirty: dirty});

  if (state.selectedIds.length === 0 && state.activeGroupKey === null) return;

  const keys = new Set(state.elements.map(el => el.key));
  const nextSelected = state.selectedIds.filter(k => keys.has(k));
  const activeGone = state.activeGroupKey !== null && !keys.has(state.activeGroupKey);

  if (nextSelected.length === state.selectedIds.length && !activeGone) return;

  useEditorStore.setState({
    selectedIds: nextSelected,
    ...(activeGone ? {activeGroupKey: null} : {}),
  });
});
