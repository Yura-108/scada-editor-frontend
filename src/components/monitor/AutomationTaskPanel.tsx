"use client";

import React, {useEffect, useMemo, useState} from "react";
import {X} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAutomationTasksStore} from "@/store/useAutomationTasksStore";
import type {AutomationTaskState, AutomationTaskStatus} from "@/types/automation.types";

export const TASK_STATE_VIEW: Record<AutomationTaskState, {label: string; className: string}> = {
  RUNNING: {label: "Работает", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"},
  DISABLED: {label: "Выключена", className: "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400"},
  INPUT_STALE: {label: "Нет свежих входов", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  OVERRUN: {label: "Не укладывается в период", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400"},
  ERROR: {label: "Ошибка", className: "bg-red-500/15 text-red-600 dark:text-red-400"},
};

const PROBLEM_STATES = new Set<AutomationTaskState>(["ERROR", "INPUT_STALE", "OVERRUN"]);

/** Сколько задач требуют внимания — для бейджа на кнопке. */
export const countTaskProblems = (byId: Record<number, AutomationTaskStatus>): number =>
  Object.values(byId).filter(t => PROBLEM_STATES.has(t.state)).length;

const formatAge = (lastRunAt: number | null, now: number): string => {
  if (lastRunAt == null) return "не запускалась";
  const seconds = Math.max(0, Math.round((now - lastRunAt) / 1000));
  return seconds < 60 ? `${seconds} с назад` : `${Math.round(seconds / 60)} мин назад`;
};

/**
 * Статусы фоновых задач проекта. Задачи крутятся в сервисе automation независимо от того,
 * открыт ли монитор, — панель только показывает то, что пришло кадром UPDATE.tasks.
 */
export function AutomationTaskPanel({onClose}: {onClose: () => void}) {
  const byId = useAutomationTasksStore(s => s.byId);
  const tasks = useMemo(
    () => Object.values(byId).sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [byId],
  );

  // «N с назад» должно идти само, даже если статус задачи не меняется.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="absolute right-3 top-3 bottom-3 z-20 w-[380px] max-w-[calc(100%-1.5rem)] flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <span className="text-sm font-semibold">Фоновые задачи</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            У проекта нет задач, или сервис automation ещё не прислал статусы.
          </p>
        )}
        {tasks.map(task => {
          const view = TASK_STATE_VIEW[task.state] ?? TASK_STATE_VIEW.ERROR;
          return (
            <div key={task.taskId} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium" title={task.name}>{task.name}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", view.className)}>{view.label}</span>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatAge(task.lastRunAt, now)}
                {task.lastDurationMs != null && ` · ${task.lastDurationMs} мс`}
                {task.errorCount > 0 && ` · ошибок подряд: ${task.errorCount}`}
              </div>
              {task.lastError && (
                <div className="text-xs text-red-600 dark:text-red-400 break-words">{task.lastError}</div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
