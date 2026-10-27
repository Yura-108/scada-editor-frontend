import type {ProjectGrant} from "@/types/access.types";

/** Проект с правами пользователя — то, что нужно `grantOf`. */
export interface ProjectWithAccess {
  id: number;
  access?: ProjectGrant;
}

/**
 * Текущий проект и список проектов: права в проекте берутся из списка (там свежее поле
 * `access`), а если проекта в списке нет — из самого текущего проекта.
 */
export interface CurrentProjectState {
  currentProject: ProjectWithAccess | null;
  projectList: ProjectWithAccess[];
}

/** Хук zustand-стора, сужённый до проекта. */
export interface CurrentProjectStore {
  <T>(selector: (state: CurrentProjectState) => T): T;
  getState: () => CurrentProjectState;
}

/**
 * Откуда права берут текущий проект. Он живёт в сторе редактора — общем для редактора и
 * монитора. `core` не знает модулей, поэтому стор регистрирует себя сам, сразу после
 * создания (`bindCurrentProjectStore`), — тот же приём, что у `bindSceneViewStore`.
 */
let store: CurrentProjectStore | null = null;

export const bindCurrentProjectStore = (s: CurrentProjectStore) => {
  store = s;
};

export const currentProjectStore = (): CurrentProjectStore => {
  if (!store) throw new Error("useEditorStore ещё не создан: bindCurrentProjectStore не вызывался");
  return store;
};
