import {pushTaskStatuses, resetTaskStatuses} from "@/store/useAutomationTasksStore";
import {adoptAlarms, bindAlarmsProject} from "./alarmsStore";
// переедет в модуль вместе с соединением (шаг 8)
import type {RuntimeConnectionHandlers} from "@/lib/runtime/runtimeConnection";

/**
 * Потоки проекта, которые идут по сокету монитора мимо тегов и привязок: их сторы живут
 * отдельно от движка, и движку достаточно сбросить их и подключить обработчики.
 */

/** Старт соединения проекта: данные прошлого проекта в панелях остаться не должны. */
export function resetProjectStreams(projectId: number): void {
  resetTaskStatuses();
  bindAlarmsProject(projectId);
}

export const projectStreamHandlers = {
  onTasks: pushTaskStatuses,
  onAlarms: adoptAlarms,
} satisfies Partial<RuntimeConnectionHandlers>;
