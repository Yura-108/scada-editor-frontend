import {toast} from "sonner";
import {useEditorStore} from "@/store/useEditorStore";
import type {SceneTarget} from "@/lib/runtime/eventScript";
import {describeSceneTarget, resolveSceneTarget} from "@/lib/runtime/sceneTarget";

/**
 * `openScene(...)` из обработчика события в мониторе: найти схему в текущем проекте и
 * открыть её.
 *
 * Отказ всегда виден оператору (тост): молча не сработавшая кнопка выглядит поломкой
 * монитора, а причина — опечатка в имени схемы у автора скрипта.
 *
 * Через `loadScene`, а не `openSceneGuarded`: монитор не редактирует, спрашивать про
 * несохранённые правки не о чем (так же переключают вкладки в MonitorClient). Сам
 * `loadScene` ещё раз сверит, что схема принадлежит текущему проекту.
 */
export const openSceneFromScript = async (target: SceneTarget, sourceLabel: string): Promise<void> => {
  const {sceneList, scene, loadScene} = useEditorStore.getState();
  const res = resolveSceneTarget(target, sceneList);

  if (res.kind !== "found") {
    const what = describeSceneTarget(target);
    const message = res.kind === "ambiguous"
      ? `Несколько схем с именем ${what} (${res.count}) — укажите id`
      : `Схема ${what} не найдена в проекте`;
    console.warn(`[monitor:event] openScene из «${sourceLabel}»: ${message}`);
    toast.error(message);
    return;
  }

  if (res.scene.id === scene?.id) return;
  await loadScene(res.scene.id);
};
