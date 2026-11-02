import {toast} from "sonner";
import {editorStore} from "./editorStoreRef";
import {canWriteCurrentProject, refuseViewOnly, sceneBelongsToCurrentProject} from "./editorStoreInternals";
import {applyScriptCodes, type ScriptCodeEdit} from "../lib/assistant/sceneScripts";

/**
 * Применяет выбранные правки помощника к документу сцены — одним шагом отмены.
 *
 * На сервер они уходят обычным сохранением сцены (с `based_on_version`), как любая ручная
 * правка: история версий и выпуск работают как раньше. Правки, чей скрипт изменился после
 * запроса, пропускаются (`stale`). `null` — применять нельзя (чужая сцена, просмотр версии,
 * нет права правки), причина уже показана.
 */
export function applyAssistantScriptEdits(edits: ScriptCodeEdit[]) {
  const store = editorStore();
  const {scene, currentProject, versionPreview, elements} = store.getState();

  if (!sceneBelongsToCurrentProject(scene, currentProject)) {
    toast.error("Нельзя применить: сцена не принадлежит выбранному проекту");
    return null;
  }
  if (versionPreview) {
    toast.error("Нельзя применить в режиме просмотра версии");
    return null;
  }
  if (!canWriteCurrentProject()) return refuseViewOnly() || null;

  const result = applyScriptCodes(elements, edits);
  // Один `setState` — одна запись в истории: отмена вернёт все применённые правки сразу.
  if (result.applied.length) store.setState({elements: result.elements});
  return {applied: result.applied, stale: result.stale};
}
