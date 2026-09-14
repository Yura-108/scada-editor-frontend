import {create} from "zustand";
import type {AutomationTaskStatus} from "@/types/automation.types";

interface AutomationTasksState {
  /** Статусы задач текущего проекта монитора по taskId. */
  byId: Record<number, AutomationTaskStatus>;
}

export const useAutomationTasksStore = create<AutomationTasksState>(() => ({byId: {}}));

/**
 * Кадр WS несёт и полный список (при подписке), и отдельные изменения — merge по taskId.
 *
 * Отличить полный список от изменений по кадру нельзя, поэтому задача, удалённая из набора,
 * остаётся в сторе до смены проекта или переподключения (там стор сбрасывается).
 */
export const pushTaskStatuses = (tasks: AutomationTaskStatus[]): void => {
  if (!tasks.length) return;
  useAutomationTasksStore.setState(state => {
    const byId = {...state.byId};
    for (const task of tasks) byId[task.taskId] = task;
    return {byId};
  });
};

export const resetTaskStatuses = (): void => {
  useAutomationTasksStore.setState({byId: {}});
};
