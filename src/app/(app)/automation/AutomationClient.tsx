"use client";

import React, {useMemo, useState} from "react";
import Link from "next/link";
import {CircleAlert, Plus, RefreshCw, Save, Send, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Badge} from "@/shared/ui/Badge";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {Spinner} from "@/shared/ui/Spinner";
import {Tabs} from "@/shared/ui/Tabs";
import {PageFrame} from "@/shared/ui/page/PageFrame";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {FloatingHelp} from "@/shared/ui/FloatingHelp";
import {UnsavedNotice} from "@/shared/ui/UnsavedNotice";
import {confirmLeave, useBeforeUnloadWarning, useUnsavedGuard} from "@/shared/lib/unsavedGuard";
import {useEditorStore, useEditableProject} from "@/modules/editor";
import {ReadOnlyBanner, useCurrentProjectGrant} from "@/core/access";
import {ProjectPlaceholder, ProjectSelect, VersionHistoryList} from "@/core/project";
import {TASK_STATE_VIEW, type AutomationTask} from "@/core/automation";
import {
  AUTOMATION_HELP, AUTOMATION_TABS, type AutomationTab, AutomationVersionChanges, compactButton, sameWatchdog,
  taskDraftState, TaskEditor, TemplatePalette, useAutomationDocument, useTaskActions, WatchdogEditor,
} from "@/modules/automation";

/**
 * Редактор фоновых задач проекта. Бэкенд принимает набор только целиком (задачи, переменные,
 * watchdog), но сохранять можно и по одной задаче: тогда на сервер уходит *сохранённый* набор
 * с заменённой задачей, а незаконченные правки соседних остаются черновиком. Удаление задачи
 * сохраняется сразу, после подтверждения, и его можно вернуть из уведомления или из «Истории».
 * Переменные правятся в разделе «Данные проекта», здесь они только едут в наборе нетронутыми.
 * Исполняет задачи сервис automation — страница нужна только для правки определений.
 */
export default function AutomationClient() {
  // Страница читает черновик проекта — нужен «просмотр» или «правка». Проект, выбранный в
  // мониторе только с «управлением», сюда не попадает: его данных раздел не показывает.
  const {projectList, project, unavailable, listLoaded} = useEditableProject();
  // Сохранять и отправлять на исполнение — только с правом правки (403 NO_EDIT).
  const canWrite = useCurrentProjectGrant().edit;
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  const [tab, setTab] = useState<AutomationTab>("tasks");
  const projectId = project?.id ?? null;
  const doc = useAutomationDocument(projectId, tab);
  const actions = useTaskActions(doc, setTab);
  const {saved, draft, saving, errors, selected, setSelected, statuses, versions, dirty} = doc;

  useUnsavedGuard("automation", {
    label: () => "задачи автоматизации",
    isDirty: () => canWrite && dirty,
    save: doc.saveAll,
  });

  // Перезагрузка страницы молча выбросила бы черновик.
  useBeforeUnloadWarning(dirty && canWrite);

  // Бэкенд обрезает пробелы в имени задачи и в errors[].task присылает уже обрезанное.
  const taskErrors = (name: string) => errors.filter(e => e.task === name.trim());
  // watchdog.tag, занятый выходом задачи, приходит с именем этой задачи — показываем его и на вкладке watchdog.
  const projectErrors = useMemo(
    () => errors.filter(e => e.task === null || e.field.startsWith("watchdog")),
    [errors],
  );
  const hasVariableErrors = projectErrors.some(e => e.field.startsWith("variables"));
  const statusOf = (task: AutomationTask) => (task.id != null ? statuses.find(s => s.taskId === task.id) : undefined);
  const task = draft?.tasks[selected];
  const unsavedCount = draft && saved
    ? draft.tasks.filter(t => taskDraftState(t, saved) !== "saved").length
      + (sameWatchdog(draft.watchdog, saved.watchdog) ? 0 : 1)
    : 0;

  return (
    <PageFrame>
      <PageHeader
        title="Автоматизация"
        actions={<>
          {saved?.version != null && <span className="text-xs text-muted-foreground" title="Версия сохранённого набора">v{saved.version}</span>}
          <IconButton icon={RefreshCw} label="Перечитать с сервера" variant="secondary" onClick={() => void doc.reload()} disabled={!draft || saving} />
          {canWrite ? <>
            <IconButton icon={Send} label="Отправить сохранённый набор в automation заново" variant="secondary" onClick={() => void doc.republish()} disabled={!draft || dirty} />
            <Button variant="primary" size="sm" onClick={() => void doc.saveAll()} disabled={!draft || !dirty || saving} title="Сохранить все задачи и watchdog одним набором">
              <Save size={14} />{saving ? "Сохранение…" : unsavedCount > 1 ? `Сохранить всё (${unsavedCount})` : "Сохранить всё"}
            </Button>
          </> : null}
        </>}
      >
        <ProjectSelect
          projects={projectList}
          value={projectId}
          onChange={async id => {
            const next = projectList.find(p => p.id === id) ?? null;
            // Черновик набора принадлежит проекту: смена проекта его выбрасывает.
            if (await confirmLeave()) setCurrentProject(next);
          }}
        />
        <Tabs aria-label="Разделы автоматизации" value={tab} onValueChange={setTab} items={AUTOMATION_TABS} />
      </PageHeader>

      {project && draft && !canWrite && <ReadOnlyBanner projectName={project.name} />}

      {projectErrors.length > 0 && (
        <Banner layout="bar" tone="destructive" icon={CircleAlert}>
          {projectErrors.map((e, i) => <div key={i}>{e.field}: {e.message}</div>)}
          {hasVariableErrors && (
            <div>
              Переменные правятся в разделе{" "}
              <Link href="/data" className="underline">«Данные проекта» → «Переменные»</Link>.
            </div>
          )}
        </Banner>
      )}

      {!draft || !saved ? (
        projectId == null
          ? <ProjectPlaceholder listLoaded={listLoaded} projectCount={projectList.length} unavailable={unavailable} />
          : <Spinner label="Загрузка…" fill />
      ) : tab === "tasks" ? (
        <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <div className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-2 pb-28 space-y-1">
            {draft.tasks.map((t, i) => {
              const status = statusOf(t);
              const state = taskDraftState(t, saved);
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
                      className="m-1.5" onClick={() => void actions.deleteTask(i)} disabled={saving} />
                  )}
                </div>
              );
            })}
            {canWrite && (
              <Button className={cn(compactButton, "w-full")} onClick={actions.addTask}>
                <Plus size={14} />Задача
              </Button>
            )}
          </div>
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
              <div className="h-full flex items-center justify-center text-sm text-neutral-500">Задач нет</div>
            )}
          </div>
          <TemplatePalette onInsert={canWrite ? actions.insertTemplate : undefined} />
        </div>
        </div>
      ) : tab === "watchdog" ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
          <WatchdogEditor watchdog={draft.watchdog} errors={projectErrors} onChange={watchdog => doc.update({watchdog})} readOnly={!canWrite} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
          <VersionHistoryList
            versions={versions}
            currentVersion={saved.version}
            dirty={dirty}
            onRestore={canWrite ? v => void doc.restore(v) : undefined}
            renderDetails={(v, previous) => projectId != null && (
              <AutomationVersionChanges
                projectId={projectId}
                versionNo={v.version_no}
                previousNo={previous?.version_no ?? (v.version_no > 1 ? v.version_no - 1 : null)}
                onReturnTask={canWrite ? actions.returnTask : undefined}
              />
            )}
          />
        </div>
      )}

      {canWrite && dirty && (
        <UnsavedNotice
          details={unsavedCount > 0 ? `Не сохранено изменений: ${unsavedCount}. Задачу можно сохранить отдельно — кнопкой в её редакторе.` : undefined}
          onSave={() => void doc.saveAll()}
          onDiscard={() => void doc.reload()}
          saving={saving}
        />
      )}
      {draft && <FloatingHelp storageKey="help.automation" title={AUTOMATION_HELP[tab].title}>{AUTOMATION_HELP[tab].body}</FloatingHelp>}
    </PageFrame>
  );
}

