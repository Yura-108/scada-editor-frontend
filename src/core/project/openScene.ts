import type {SceneType} from "@/types/editorElement.type";
import type {EditorProject} from "./projects";

/**
 * Открытый проект и сцена — то, что о них читает монитор, и действия, которые он вызывает.
 *
 * Состояние живёт в сторе редактора: загрузка сцены пишет документ, историю, выделение и
 * черновик, и разносить это по двум сторам — правка логики сохранения ради одного чтения.
 * `core` не знает модулей, поэтому стор регистрирует себя сам, сразу после создания
 * (`bindOpenSceneStore`), — тот же приём, что у `bindSceneViewStore`. Подписки идут в тот же
 * стор теми же селекторами: перерисовки не меняются.
 */
export interface OpenSceneState {
  currentProject: EditorProject | null;
  scene: SceneType | null;
  sceneList: {id: number; name: string}[];
  /** Номер выпуска, который показывает монитор; null — выпуск ещё не получен. */
  releaseVersionNo: number | null;
  loadScene: (id: number, opts?: {keepHistory?: boolean}) => Promise<void>;
  setReleaseVersionNo: (versionNo: number | null) => void;
  /** Перечитать список схем и схему выпуска под новым номером. */
  reloadRelease: (versionNo: number) => Promise<void>;
}

/** Хук zustand-стора, сужённый до открытой сцены. */
export interface OpenSceneStore {
  <T>(selector: (state: OpenSceneState) => T): T;
  getState: () => OpenSceneState;
}

let store: OpenSceneStore | null = null;

export const bindOpenSceneStore = (s: OpenSceneStore) => {
  store = s;
};

const bound = (): OpenSceneStore => {
  if (!store) throw new Error("useEditorStore ещё не создан: bindOpenSceneStore не вызывался");
  return store;
};

/** Подписка на открытую сцену (селектор — как у `useEditorStore`). */
export function useOpenScene<T>(selector: (state: OpenSceneState) => T): T {
  return bound()(selector);
}

/** Открытая сцена прямо сейчас — для обработчиков событий, не для рендера. */
export const getOpenScene = (): OpenSceneState => bound().getState();
