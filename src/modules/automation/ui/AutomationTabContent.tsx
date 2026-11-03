"use client";

import React from "react";
import {VersionHistoryList} from "@/core/project";
import type {AutomationValidationError} from "@/core/automation";
import {taskDraftState} from "../lib/automationDraft";
import type {AutomationDocument} from "../model/useAutomationDocument";
import type {useTaskActions} from "../model/useTaskActions";
import type {AutomationTab} from "./automationHelp";
import {AutomationVersionChanges} from "./AutomationVersionChanges";
import {TaskEditor} from "./TaskEditor";
import {TaskList} from "./TaskList";
import {TemplatePalette} from "./TemplatePalette";
import {WatchdogEditor} from "./WatchdogEditor";

/** Содержимое вкладки «Автоматизации», когда набор загружен. */
export function AutomationTabContent({tab, projectId, canWrite, doc, actions, taskErrors, projectErrors}: {
  tab: AutomationTab;
  projectId: number;
  canWrite: boolean;
  doc: AutomationDocument;
  actions: ReturnType<typeof useTaskActions>;
  taskErrors: (name: string) => AutomationValidationError[];
  projectErrors: AutomationValidationError[];
}) {
  const draft = doc.draft!;
  const saved = doc.saved!;
  const {selected, saving} = doc;
  const task = draft.tasks[selected];

  if (tab === "tasks") {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <TaskList
            doc={doc}
            canWrite={canWrite}
            taskErrors={taskErrors}
            onDelete={i => void actions.deleteTask(i)}
            onAdd={actions.addTask}
          />
          <div className="flex-1 min-w-0 min-h-0">
            {task ? (
              <TaskEditor
                task={task}
                variables={draft.variables}
                errors={taskErrors(task.name)}
                onChange={t => doc.updateTask(selected, t)}
                draftState={taskDraftState(task, saved)}
                onSave={canWrite ? () => void actions.saveTask(selected) : undefined}
                onRevert={canWrite ? () => actions.revertTask(selected) : undefined}
                saving={saving}
                onSaveAsTemplate={() => actions.saveAsTemplate(task)}
                readOnly={!canWrite}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Задач нет</div>
            )}
          </div>
          <TemplatePalette onInsert={canWrite ? actions.insertTemplate : undefined} />
        </div>
      </div>
    );
  }
  if (tab === "watchdog") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pb-24">
        <WatchdogEditor watchdog={draft.watchdog} errors={projectErrors} onChange={watchdog => doc.update({watchdog})} readOnly={!canWrite} />
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-24">
      <VersionHistoryList
        versions={doc.versions}
        currentVersion={saved.version}
        dirty={doc.dirty}
        onRestore={canWrite ? v => void doc.restore(v) : undefined}
        renderDetails={(v, previous) => (
          <AutomationVersionChanges
            projectId={projectId}
            versionNo={v.version_no}
            previousNo={previous?.version_no ?? (v.version_no > 1 ? v.version_no - 1 : null)}
            onReturnTask={canWrite ? actions.returnTask : undefined}
          />
        )}
      />
    </div>
  );
}
