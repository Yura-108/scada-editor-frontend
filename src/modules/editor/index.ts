// Стор — первым: если в коде слайсов появится цикл обратно на стор, стор всё равно начнёт
// загрузку раньше любого слайса и вызовет их уже определёнными.
// Проверка циклов: npm run check:store-cycles.
export {useEditorStore, type EditorProject, type EditorState} from "./model/editorStore";
export {recipeKeys, useInvalidateRecipes, useRecipeMutations, useRecipes} from "./api/recipes";
export {createCameraSlice, type CameraSlice} from "./model/slices/camera.slice";
export {createSelectionSlice, type SelectionSlice} from "./model/slices/selection.slice";
export {editorSession} from "./model/editorSession";
export {bindEditorStore, editorStore} from "./model/editorStoreRef";
export {
  adoptPropertyEditVersion,
  applyLoadedScene,
  applyServerComponents,
  canWriteCurrentProject,
  deleteComponentsRequest,
  discardVersionPreview,
  enterVersionPreview,
  getErrorMessage,
  hasUnsavedWork,
  invalidProperties,
  logSceneTiming,
  markSceneSaved,
  parseBackendErrorMessage,
  rebaseHistoryIds,
  refuseViewOnly,
  renamePropertyOnServer,
  reportMergedChanges,
  revalidateCachedScene,
  SCENE_EXPORT_FORMAT,
  sceneBelongsToCurrentProject,
  type SceneExportFile,
  scheduleScenePrefetch,
  VERSIONS_PAGE_SIZE,
} from "./model/editorStoreInternals";
export {createSaveSlice, type SaveSlice} from "./model/slices/save.slice";
export {createVersionsSlice, type VersionsSlice} from "./model/slices/versions.slice";
export {createProjectsSlice, type ProjectsSlice} from "./model/slices/projects.slice";
export {createScenesSlice, type ScenesSlice} from "./model/slices/scenes.slice";
export {
  applyShifts, cloneElementsWithOffset, getDescendantKeys, isComplex, isComponentEl, isGroup, isLeafPrimitive,
  recomputeAncestorBounds, resplitContainer, topLevelSelectedKeys,
} from "./model/elementTree";
export {
  BASE_ONLY_KEYS, cascadeStateByName, ensureStateByName, isPatchEffective, isSameValue, splitBaseOnly,
  syncMemberStates,
} from "./model/elementStates";
export {createLayoutSlice, type LayoutSlice} from "./model/slices/layout.slice";
export {createStatesSlice, type StatesSlice} from "./model/slices/states.slice";
export {createPropertiesSlice, type PropertiesSlice} from "./model/slices/properties.slice";
export {createElementsSlice, type ElementsSlice} from "./model/slices/elements.slice";
export {createClipboardSlice, type ClipboardSlice} from "./model/slices/clipboard.slice";
export {createGroupsSlice, type GroupsSlice} from "./model/slices/groups.slice";
export {beginHistoryGroup, cancelHistoryGroup, endHistoryGroup} from "./model/historyGroup";
export {restoreLastProject, useEditableProject} from "./model/lastProject";
export {openSceneGuarded, selectProjectGuarded} from "./model/openScene";
export {confirmDeleteProperty} from "./lib/confirmDeleteProperty";

// UI — последним: компонентам нужен уже загруженный стор, а не наоборот.
export {PropertiesPanel} from "./ui/properties-panel";
export {Canvas} from "./ui/canvas";
export {ToolsPanel} from "./ui/tools-panel";
export {WorkSpace} from "./ui/workspace";
export {SceneTabs} from "./ui/scene-tabs/SceneTabs";
export {useSceneCameraMemory} from "./ui/canvas/hooks/useSceneCameraMemory";
export {openReleasesModal} from "./ui/project/ReleasesModal";
export {openProcedureLevelsModal} from "./ui/project/ProcedureLevelsModal";
export {useSceneChangedNotifications} from "./ui/hooks/useSceneChangedNotifications";
