import type {EditorState} from "./editorStore";
import {editorSession} from "./editorSession";

type DraftStash = NonNullable<typeof editorSession.draftStash>;

/**
 * Черновик редактора, который откладывается при входе в монитор (`setSceneSource("release")`).
 * Снимок «что на сервере» — тоже, иначе при возврате isDirty пересчитался бы от выпуска.
 * Зачем стеш вообще — см. `editorSession.draftStash`.
 */
export const takeDraftStash = (s: EditorState): DraftStash => ({
  projectId: s.currentProject?.id ?? null,
  scene: s.scene,
  sceneList: s.sceneList,
  elements: s.elements,
  selectedIds: s.selectedIds,
  activeGroupKey: s.activeGroupKey,
  currentComponentStateByElementKey: s.currentComponentStateByElementKey,
  isDirty: s.isDirty,
  sceneVersion: s.sceneVersion,
  savedSnapshot: editorSession.savedElementsSnapshot,
});

/** Поля стора, которыми черновик возвращается на место при выходе из монитора. */
export const draftStashPatch = (stash: DraftStash): Partial<EditorState> => ({
  scene: stash.scene,
  sceneList: stash.sceneList,
  elements: stash.elements,
  selectedIds: stash.selectedIds,
  activeGroupKey: stash.activeGroupKey,
  selectedTableCell: null,
  currentComponentStateByElementKey: stash.currentComponentStateByElementKey,
  isDirty: stash.isDirty,
  sceneVersion: stash.sceneVersion,
});
