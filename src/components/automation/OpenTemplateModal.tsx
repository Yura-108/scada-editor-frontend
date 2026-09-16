import {useModalStore} from "@/store/modalStore";
import {TemplateEditor} from "@/components/automation/TemplateEditor";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";

interface Options {
  mode: "create" | "edit";
  initial: AutomationTaskTemplate;
  onSaved?: (template: AutomationTaskTemplate) => void;
}

/**
 * Форма шаблона — во весь экран: внутри редактор скрипта, в обычную модалку он не помещается
 * (тот же приём, что у редактора скриптов элемента).
 */
export function openTemplateModal(options: Options) {
  useModalStore.getState().openModal(<TemplateEditor {...options} />, {variant: "fullscreen"});
}
