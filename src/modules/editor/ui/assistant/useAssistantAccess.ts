import {useEditorStore} from "../../model/editorStore";
import {useToolbarAccess} from "../tools-panel/hooks/useToolbarAccess";

/**
 * Доступен ли помощник здесь и сейчас: нужна сцена текущего проекта, не режим просмотра
 * версии и право `edit` (без него сервис ответит 403, не дойдя до модели). Блоки помощника
 * без доступа не показываем вовсе — функция тестовая, редактор без неё работает как обычно.
 */
export function useAssistantAccess() {
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const {canSave} = useToolbarAccess();
  return {projectId, available: canSave && projectId != null};
}
