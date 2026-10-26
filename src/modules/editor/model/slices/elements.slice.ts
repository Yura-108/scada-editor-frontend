import {snap, GRID} from "@/lib/utils";
import type {MonitorView} from "@/lib/editor/monitorView";
import {DiagramElement, ElementType} from "@/types/editorElement.type";
import {
  isMetaElement, isSameSheet, resolveSheet, SHEET_MAX, SHEET_MIN,
} from "@/lib/editor/sheet";
import {toast} from "sonner";
import type {EditorState} from "../editorStore";
import {
  sceneBelongsToCurrentProject,
} from "../editorStoreInternals";
import {buildNewElement} from "../newElement";
import {placeNewElement} from "../placeNewElement";
import {applyVisualPatch} from "../visualPatch";
import {removeElementsCascade} from "../removeElements";
import {newMetaElement} from "../metaElement";

/**
 * Зона «Элементы» документа стора редактора: сам массив `elements`, правка элемента и его
 * визуала (с пересчётом рамок групп), постановка нового элемента, удаление выделенного,
 * лист сцены и зафиксированный вид монитора. Правила — docs/domain/editor-model.md.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6): всё, что меняет
 * `elements`, идёт в undo и в сохранение. Код перенесён без изменений.
 */
export interface ElementsSlice {
  elements: DiagramElement[];
  /** Размер листа сцены. Читается из elements (`resolveSheet`), тут только запись. */
  setSheet: (w: number, h: number) => void;
  connecting: {
    fromNode: string;
    fromPort: string;
    mouseX: number;
    mouseY: number;
  } | null;

  /**
   * Зафиксировать вид сцены для монитора (замок в панели зума редактора) или снять его
   * (`null`). Это данные сцены, а не состояние просмотра: вид пишется в служебный элемент
   * рядом с размером листа, попадает в undo, помечает сцену несохранённой и уезжает на
   * сервер с сохранением. См. lib/editor/monitorView.ts.
   */
  setMonitorView: (view: MonitorView | null) => void;

  updateElement: (id: string, data: Partial<DiagramElement>) => void;
  updateElementVisual: (id: string, data: Partial<DiagramElement>) => void;
  /** Мульти-версия updateElementVisual: один шаг undo для всех ключей. */
  updateElementsVisual: (keys: string[], data: Partial<DiagramElement>) => void;
  addElementAt: (x: number, y: number, type: ElementType, extraProps?: Record<string, unknown>) => void;
  deleteSelectedElement: () => void;
}

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

export const createElementsSlice = (set: EditorSet, get: () => EditorState): ElementsSlice => ({
  elements: [],
  connecting: null,

  setMonitorView: (view) => {
    const {scene, currentProject, versionPreview} = get();
    // Просмотр версии — только для чтения; сцена чужого проекта — не наша.
    if (versionPreview || !sceneBelongsToCurrentProject(scene, currentProject)) return;

    set(state => {
      const meta = state.elements.find(isMetaElement);
      if (meta) {
        const {monitorView: _old, ...rest} = meta as unknown as Record<string, unknown>;
        void _old;
        const next = view ? {...rest, monitorView: view} : rest;
        return {
          elements: state.elements.map(el => el.key === meta.key ? next as unknown as DiagramElement : el),
        };
      }
      if (!view) return {};

      // Служебного элемента ещё нет (лист по умолчанию) — заводим его тем же видом, что
      // и setSheet, но без блока `canvas`: лист остаётся по умолчанию.
      const created = newMetaElement(scene?.id, {monitorView: view});
      return {elements: [...state.elements, created]};
    });
  },

  /**
   * Размер листа сцены.
   *
   * Пишем в блок `canvas` служебного элемента, а не в поля сцены: эндпоинта
   * обновления сцены не существует (у неё только GET, POST-создание и DELETE),
   * а служебный элемент сохраняется вместе со всеми остальными и переживает
   * round-trip. Приём не наш — так уже устроен `contur_meta` у CONTUR.
   */
  setSheet: (w, h) => {
    const {scene, currentProject} = get();
    if (!sceneBelongsToCurrentProject(scene, currentProject)) return;

    const clamp = (v: number) => Math.min(SHEET_MAX, Math.max(SHEET_MIN, snap(v)));
    const next = {w: clamp(w), h: clamp(h)};
    if (isSameSheet(resolveSheet(get().elements), next)) return;

    set(state => {
      const meta = state.elements.find(isMetaElement);

      if (meta) {
        return {
          elements: state.elements.map(el => el.key === meta.key
            ? {
              ...el,
              canvas: {
                // Остальные поля блока (units/grid/scale/origin) — данные CONTUR,
                // сохраняем как есть.
                ...((el as unknown as Record<string, unknown>).canvas as object ?? {}),
                width: next.w,
                height: next.h,
              },
            } as unknown as DiagramElement
            : el),
        };
      }

      const created = newMetaElement(scene?.id, {canvas: {width: next.w, height: next.h, units: "px", grid: GRID}});

      return {elements: [...state.elements, created]};
    });
  },
  updateElementVisual: (key, updates) => get().updateElementsVisual([key], updates),
  // Мульти-версия: один set() (= один шаг undo) для всех ключей.
  updateElementsVisual: (keys, updates) => {
    if (!keys.length) return;
    const {currentComponentStateByElementKey, editAllStates} = get();

    set(state => {
      const next = applyVisualPatch(state.elements, keys, updates, {
        stateByKey: currentComponentStateByElementKey,
        editAllStates,
        sceneId: state.scene?.id,
      });
      // Ни один элемент не изменился — массив не трогаем (см. applyVisualPatch).
      return next ? {elements: next} : {};
    });
  },
  updateElement: (key, updates) => {
    set(state => ({
      elements: state.elements.map(el =>
        el.key === key
          ? { ...el, ...updates } as DiagramElement
          : el
      )
    }));
  },
  addElementAt: (screenX, screenY, type, extraProps) => {
    const {scene, currentProject} = get();
    const rect = get().canvasRect;
    if (!rect) return;

    if (!sceneBelongsToCurrentProject(scene, currentProject)) {
      toast.error("Нельзя добавить элемент: сцена не принадлежит выбранному проекту");
      return;
    }

    const x = snap(screenX);
    const y = snap(screenY);

    // Элемент строится в мировых координатах в корне сцены; в открытый контейнер его
    // переносит placeNewElement.
    const element = buildNewElement(type, x, y, scene?.id, extraProps);
    const {activeGroupKey, elements} = get();
    set({elements: placeNewElement(elements, element, activeGroupKey, scene?.id)});
  },
  deleteSelectedElement: async () => {
    const { selectedIds, elements, activeGroupKey, scene } = get();
    if (!selectedIds.length) return;

    const {elements: nextElements, deletedKeys: idsToDelete} = removeElementsCascade(elements, selectedIds, scene?.id);

    // Удаление живёт только локально и уезжает ближайшим сохранением: тело `PUT`
    // описывает состав сцены целиком, и компонента, которого в нём нет, сервер
    // удаляет сам. Отдельный `DELETE` тут был нужен старому upsert-`POST`, который
    // возвращал удалённое обратно; с новым контрактом это второй версионируемый
    // путь записи со своим 409 — и лишний.
    set({
      elements: nextElements,
      selectedIds: [],
      selectedTableCell: null,
      currentComponentStateByElementKey: Object.fromEntries(
        Object.entries(get().currentComponentStateByElementKey).filter(
          ([elementKey]) => !idsToDelete.has(elementKey)
        )
      ),
      // Если удалили группу, внутри которой находились — выходим из неё.
      ...(activeGroupKey && idsToDelete.has(activeGroupKey) ? {activeGroupKey: null} : {}),
    });
  },
});
