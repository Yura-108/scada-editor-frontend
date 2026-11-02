import type {Tone} from "@/shared/ui/tone";
import type {AutomationTaskState} from "./types/automation.types";

/** Подпись и тон значка состояния задачи — в панели задач монитора и в списке задач «Автоматизации». */
export const TASK_STATE_VIEW: Record<AutomationTaskState, {label: string; tone: Tone}> = {
  RUNNING: {label: "Работает", tone: "success"},
  DISABLED: {label: "Выключена", tone: "neutral"},
  INPUT_STALE: {label: "Нет свежих входов", tone: "warning"},
  OVERRUN: {label: "Не укладывается в период", tone: "warning"},
  ERROR: {label: "Ошибка", tone: "destructive"},
};
