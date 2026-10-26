import {pushTaskStatuses, resetTaskStatuses} from "@/store/useAutomationTasksStore";
// переедет в модуль вместе с соединением (шаг 8)
import type {RuntimeConnectionHandlers} from "@/lib/runtime/runtimeConnection";

/**
 * Потоки проекта, которые идут по сокету монитора мимо тегов и привязок: их сторы живут
 * отдельно от движка, и движку достаточно сбросить их и подключить обработчики.
 */

/** Сброс при старте соединения проекта: данные прошлого проекта в панелях остаться не должны. */
export function resetProjectStreams(): void {
  resetTaskStatuses();
}

export const projectStreamHandlers = {
  onTasks: pushTaskStatuses,
} satisfies Partial<RuntimeConnectionHandlers>;
