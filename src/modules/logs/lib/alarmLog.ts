import type {AlarmLogEvent} from "../alarmLog.types";

export const ALARM_EVENT_LABEL: Record<AlarmLogEvent, string> = {
  RAISED: "Возникла",
  ACCEPTED: "Подтверждена (причина ещё есть)",
  RETURNED: "Причина устранена, ждёт подтверждения",
  CLEARED: "Снята",
  SUPPRESSED: "Подавлена",
  UNSUPPRESSED: "Подавление снято",
};

export const ALARM_GROUPS = ["тревога", "сообщение", "ответ"] as const;

export const ALARM_LOG_PAGE_SIZE = 100;

/** Тон бейджа группы — по приоритету, как цвет аварии в мониторе. */
export function alarmPriorityTone(priority: number): "error" | "warn" | "neutral" {
  if (priority <= 250) return "error";
  if (priority <= 500) return "warn";
  return "neutral";
}
