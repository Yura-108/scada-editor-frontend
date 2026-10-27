import type {ProjectRuntimeInfo} from "@/core/project";
import {confirmModal} from "@/components/ui/ConfirmModal";
import type {EditorState} from "./editorStore";
import {hasUnsavedWork} from "./editorStoreInternals";

/** Флаг эксплуатации и prod-выпуск проекта — в карты стора. */
export const runtimeInfoPatch = (
  state: EditorState,
  projectId: number,
  info: ProjectRuntimeInfo,
): Partial<EditorState> => ({
  projectRuntimeFlags: {...state.projectRuntimeFlags, [projectId]: info.inOperation},
  projectProdVersions: {...state.projectProdVersions, [projectId]: info.prodVersionNo},
});

/**
 * Перед действием над проектом, которое читает или пишет СОХРАНЁННОЕ (выпуск, автопривязка):
 * если в открытой схеме этого проекта есть несохранённые правки — спросить и сохранить.
 * `false` — пользователь отказался или сохранение не прошло; действие не выполняем.
 */
export async function saveBeforeProjectAction(
  get: () => EditorState,
  projectId: number,
  texts: {title: string; description: string; confirmLabel: string},
): Promise<boolean> {
  const {scene, currentProject} = get();
  if (!(scene && currentProject?.id === projectId && hasUnsavedWork())) return true;

  const ok = await confirmModal(texts);
  if (!ok) return false;
  return get().exportScene({kind: "MANUAL"});
}
