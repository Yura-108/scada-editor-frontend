"use client";

import React from "react";
import {Plus, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Badge} from "@/shared/ui/Badge";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {TASK_STATE_VIEW, type AutomationTask, type AutomationValidationError} from "@/core/automation";
import {taskDraftState} from "../lib/automationDraft";
import type {AutomationDocument} from "../model/useAutomationDocument";
import {compactButton} from "./formStyles";

/** Список задач слева: статус на сервере, «не сохранена» / «изменена», удаление, «+ Задача». */
export function TaskList({doc, canWrite, taskErrors, onDelete, onAdd}: {
  doc: AutomationDocument;
  canWrite: boolean;
  taskErrors: (name: string) => AutomationValidationError[];
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  const {draft, saved, selected, setSelected, statuses, saving} = doc;
  const statusOf = (task: AutomationTask) => (task.id != null ? statuses.find(s => s.taskId === task.id) : undefined);

  return (
    <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-2 pb-28 space-y-1">
      {draft!.tasks.map((t, i) => {
        const status = statusOf(t);
        const state = taskDraftState(t, saved!);
        return (
          <div
            key={t.id ?? `new-${i}`}
            className={cn("flex items-start rounded-lg", i === selected ? "bg-primary/15" : "hover:bg-accent")}
          >
            <button onClick={() => setSelected(i)} className="flex-1 min-w-0 text-left px-3 py-2 text-sm">
              <div className={cn("truncate", taskErrors(t.name).length > 0 && "text-destructive")}>{t.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {/* Статус — то, что исполняет сервер, поэтому он виден и при правках в черновике. */}
                {status && (
                  <Badge tone={TASK_STATE_VIEW[status.state]?.tone ?? "neutral"}>
                    {TASK_STATE_VIEW[status.state]?.label ?? status.state}
                  </Badge>
                )}
                {state === "new" && <Badge tone="warning">не сохранена</Badge>}
                {state === "changed" && <Badge tone="warning">изменена</Badge>}
              </div>
            </button>
            {canWrite && (
              <IconButton icon={X} label={`Удалить задачу ${t.name}`} title="Удалить задачу" variant="danger" size="xs"
                className="m-1.5" onClick={() => onDelete(i)} disabled={saving} />
            )}
          </div>
        );
      })}
      {canWrite && (
        <Button className={cn(compactButton, "w-full")} onClick={onAdd}>
          <Plus size={14} />Задача
        </Button>
      )}
    </div>
  );
}
