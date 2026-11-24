"use client";

import React, {useEffect, useMemo, useState} from "react";
import {X} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import {EmptyState} from "@/shared/ui/EmptyState";
import {IconButton} from "@/shared/ui/IconButton";
import {useAutomationTasksStore} from "../model/useAutomationTasksStore";
import {TASK_STATE_VIEW, type AutomationTaskState, type AutomationTaskStatus} from "@/core/automation";

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
  // Порядок — как в «Автоматизации» (по созданию, т. е. по id), а не по имени: по-русски
  // «Петя 22» встаёт раньше «Петя1», и списки расходились (#6 п. 8).
  const tasks = useMemo(
    () => Object.values(byId).sort((a, b) => a.taskId - b.taskId),
    [byId],
  );

  // «N с назад» должно идти само, даже если статус задачи не меняется.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    // Колонка рядом со схемой, а не слой поверх: сдвигает содержимое, ничего не закрывая.
    <aside className="w-[360px] max-w-[45%] shrink-0 flex flex-col border-l bg-card">

      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Фоновые задачи</span>
        <IconButton icon={X} label="Закрыть" onClick={onClose} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 && (
          <EmptyState size="sm" title="У проекта нет задач, или сервис automation ещё не прислал статусы." />
        )}
        {tasks.map(task => {
          const view = TASK_STATE_VIEW[task.state] ?? TASK_STATE_VIEW.ERROR;
          return (
            <div key={task.taskId} className="rounded-xl border px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium" title={task.name}>{task.name}</span>
                <Badge tone={view.tone}>{view.label}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatAge(task.lastRunAt, now)}
                {task.lastDurationMs != null && ` · ${task.lastDurationMs} мс`}
                {task.errorCount > 0 && ` · ошибок подряд: ${task.errorCount}`}
              </div>
              {task.lastError && (
                <div className="text-xs text-destructive break-words">{task.lastError}</div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
