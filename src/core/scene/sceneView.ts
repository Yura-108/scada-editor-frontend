import type {DiagramElement, ElementType} from "@/types/editorElement.type";

/**
 * То, что холст читает о сцене: документ, выделение, камера, правка текста, — и запись
 * рантайм-состояний монитором.
 *
 * Состояние живёт в сторе редактора — общем для редактора и монитора. `core` не знает
 * модулей, поэтому стор регистрирует себя сам, сразу после создания (`bindSceneViewStore`),
 * — тот же приём, что у `bindActiveStateReader`. Подписки фигур идут в тот же стор теми же
 * селекторами: перерисовки и мемоизация не меняются.
 */
export interface SceneViewState {
  elements: DiagramElement[];
  selectedIds: string[];
  selectedTableCell: {elementKey: string; row: number; col: number} | null;
  activeGroupKey: string | null;
  editingTextKey: string | null;
  currentComponentStateByElementKey: Record<string, string>;
  camera: {x: number; y: number; zoom: number};
  pendingPlacement: {id: number; type: ElementType; template?: DiagramElement[]} | null;
  /**
   * Запись монитора: активные состояния и рантайм-свойства элементов одним пакетом (одна
   * перерисовка); без фактических изменений стор не трогается.
   */
  applyRuntimeBatch: (batch: {
    stateNameByKey?: Record<string, string>;
    propsByKey?: Record<string, Record<string, unknown>>;
    noDataKeys?: Set<string>;
  }) => void;
  /** Сброс всех рантайм-карт (выход из монитора). */
  clearRuntime: () => void;
}

/** Хук zustand-стора, сужённый до того, что нужно холсту. */
export interface SceneViewStore {
  <T>(selector: (state: SceneViewState) => T): T;
  getState: () => SceneViewState;
}

let store: SceneViewStore | null = null;

export const bindSceneViewStore = (s: SceneViewStore) => {
  store = s;
};

const bound = (): SceneViewStore => {
  if (!store) throw new Error("useEditorStore ещё не создан: bindSceneViewStore не вызывался");
  return store;
};

/** Подписка фигуры на срез сцены (селектор — как у `useEditorStore`). */
export function useSceneView<T>(selector: (state: SceneViewState) => T): T {
  return bound()(selector);
}

/** Сцена прямо сейчас — для обработчиков событий, не для рендера. */
export const getSceneView = (): SceneViewState => bound().getState();
