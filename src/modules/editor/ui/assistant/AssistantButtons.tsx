import React from "react";
import {FileCode2, LayoutTemplate} from "lucide-react";
import {TooltipBtn, ToolbarDivider} from "../tools-panel/TooltipBtn";
import {useAssistantAccess} from "./useAssistantAccess";
import {openBulkScriptEditModal} from "./bulk-edit/BulkScriptEditModal";
import {openScenePlanModal} from "./scene-plan/ScenePlanModal";

/**
 * Кнопки помощника в тулбаре редактора. Без доступа (нет права правки, чужая сцена,
 * просмотр версии) их нет вовсе: функция тестовая, редактор работает и без неё.
 */
export function AssistantButtons() {
  const {available} = useAssistantAccess();
  if (!available) return null;

  return (
    <>
      <ToolbarDivider />
      <TooltipBtn
        icon={<FileCode2 size={16} />}
        label="Правка скриптов помощником"
        onClick={openBulkScriptEditModal}
      />
      <TooltipBtn
        icon={<LayoutTemplate size={16} />}
        label="План сцены от помощника"
        onClick={openScenePlanModal}
      />
    </>
  );
}
