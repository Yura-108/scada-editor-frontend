"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {Plus, RefreshCw, Save, Send} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useEditorStore} from "@/store/useEditorStore";
import {
  AutomationSaveError,
  fetchAutomation,
  fetchAutomationVersions,
  fetchTaskStatuses,
  republishAutomation,
  restoreAutomationVersion,
  saveAutomation,
} from "@/lib/automation/automationApi";
import {TASK_STATE_VIEW} from "@/components/monitor/AutomationTaskPanel";
import {TaskEditor} from "@/components/automation/TaskEditor";
import {WatchdogEditor} from "@/components/automation/WatchdogEditor";
import {VersionHistoryList} from "@/components/automation/VersionHistoryList";
import {TemplatePalette} from "@/components/automation/TemplatePalette";
import {openTemplateModal} from "@/components/automation/OpenTemplateModal";
import {
  missingVariables,
  stripIoHints,
  taskToTemplate,
  templateToDraftTask,
} from "@/lib/automation/automationTemplates";
import type {
  AutomationSet,
  AutomationTask,
  AutomationTaskStatusRow,
  AutomationValidationError,
} from "@/types/automation.types";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";
import type {VersionSummary} from "@/types/editorVersion.types";

type Tab = "tasks" | "watchdog" | "history";

const TAB_LABELS: Record<Tab, string> = {tasks: "Задачи", watchdog: "Watchdog", history: "История"};

const newTask = (index: number): AutomationTask => ({
  id: null,
  name: `Задача ${index}`,
  // Новая задача выключена: включают осознанно, когда входы и выходы проверены.
  enabled: false,
  period_ms: 1000,
  timeout_ms: 100,
  stale_after_ms: 5000,
  run_on_stale: false,
  inputs: [],
  outputs: [],
  writes_variables: [],
  script: "// inputs.<alias> — значения входов, write('<alias>', value) — запись выхода\n"
    + "// state — память между тактами, dt — мс с прошлого успешного такта, firstRun\n",
});

/**
 * Редактор фоновых задач проекта. Сохраняется набор целиком: задачи, переменные, watchdog.
 * Переменные правятся в разделе «Данные проекта», здесь они только едут в наборе нетронутыми.
 * Исполняет задачи сервис automation — страница нужна только для правки определений.
 */
export default function AutomationClient() {
  const projectList = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  const setCurrentProject = useEditorStore(s => s.setCurrentProject);

  const [draft, setDraft] = useState<AutomationSet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<AutomationValidationError[]>([]);
  const [tab, setTab] = useState<Tab>("tasks");
  const [selected, setSelected] = useState(0);
  const [statuses, setStatuses] = useState<AutomationTaskStatusRow[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  const projectId = currentProject?.id ?? null;

  const reload = useCallback(async () => {
    // Набор прошлого проекта не должен висеть на экране, пока грузится новый.
    setDraft(null);
    if (projectId == null) return;
    try {
      const [set, rows] = await Promise.all([fetchAutomation(projectId), fetchTaskStatuses(projectId)]);
      setDraft(set);
      setStatuses(rows);
      setDirty(false);
      setErrors([]);
      setSelected(0);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (tab !== "history" || projectId == null) return;
    fetchAutomationVersions(projectId).then(setVersions).catch(err => toast.error((err as Error).message));
  }, [tab, projectId, draft?.version]);

  const update = (patch: Partial<AutomationSet>) => {
    setDraft(d => (d ? {...d, ...patch} : d));
    setDirty(true);
  };

  const updateTask = (index: number, task: AutomationTask) =>
    update({tasks: draft!.tasks.map((t, i) => (i === index ? task : t))});

  const handleSave = async () => {
    if (!draft || projectId == null) return;
    setSaving(true);
    try {
      const saved = await saveAutomation(projectId, {
        based_on_version: draft.version,
        // example_tag — наша подсказка от шаблона, у задачи на бэкенде такого поля нет.
        tasks: stripIoHints(draft.tasks),
        variables: draft.variables,
        watchdog: draft.watchdog,
      });
      setDraft(saved);
      setDirty(false);
      setErrors([]);
      toast.success(`Сохранено, версия ${saved.version}`);
    } catch (err) {
      if (err instanceof AutomationSaveError && err.errors.length) {
        setErrors(err.errors);
        toast.error(`Набор не прошёл проверку: ${err.errors.length}`);
      } else {
        toast.error((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRepublish = async () => {
    if (projectId == null) return;
    try {
      await republishAutomation(projectId);
      toast.success("Набор отправлен в automation заново");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRestore = async (versionNo: number) => {
    if (projectId == null) return;
    const ok = await confirmModal({
      title: `Восстановить версию ${versionNo}?`,
      description: "Набор задач заменится содержимым этой версии и сразу уйдёт в automation. "
        + "История не теряется: восстановление запишется новой версией.",
      confirmLabel: "Восстановить",
      danger: true,
    });
    if (!ok) return;
    try {
      await restoreAutomationVersion(projectId, versionNo);
      await reload();
      toast.success(`Версия ${versionNo} восстановлена`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Бэкенд обрезает пробелы в имени задачи и в errors[].task присылает уже обрезанное.
  const taskErrors = (name: string) => errors.filter(e => e.task === name.trim());
  // watchdog.tag, занятый выходом задачи, приходит с именем этой задачи — показываем его и на вкладке watchdog.
  const projectErrors = useMemo(
    () => errors.filter(e => e.task === null || e.field.startsWith("watchdog")),
    [errors],
  );
  const hasVariableErrors = projectErrors.some(e => e.field.startsWith("variables"));
  const statusOf = (task: AutomationTask) => statuses.find(s => s.taskId === task.id);
  const task = draft?.tasks[selected];

  /** Вставка из палитры: в набор кладётся черновик, он уедет обычным сохранением набора. */
  const handleInsertTemplate = (template: AutomationTaskTemplate) => {
    if (!draft) return;
    update({tasks: [...draft.tasks, templateToDraftTask(template, draft.tasks.map(t => t.name))]});
    setSelected(draft.tasks.length);

    // Набор ответит «Переменная 'X' не объявлена» уже при сохранении — говорим сразу.
    const missing = missingVariables(template, draft.variables);
    if (missing.length) {
      toast.warning(`Переменные не объявлены в проекте: ${missing.join(", ")}`, {
        description: "Заведите их в разделе «Данные проекта» → «Переменные» "
          + "или снимите отметки у задачи, иначе набор не сохранится.",
        duration: 12_000,
      });
    }
  };

  const handleSaveAsTemplate = () => {
    if (!task) return;
    openTemplateModal({mode: "create", initial: taskToTemplate(task)});
  };

  return (
    <div className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80">
        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Автоматизация</span>
        <select
          className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm"
          value={projectId ?? ""}
          onChange={e => setCurrentProject(projectList.find(p => p.id === Number(e.target.value)) ?? null)}
        >
          <option value="" disabled>Проект…</option>
          {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(Object.keys(TAB_LABELS) as Tab[]).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn("px-3 py-1 rounded-lg text-sm", tab === key ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
        <div className="flex-1" />
        {draft && <span className="text-xs text-neutral-500">версия {draft.version ?? "—"}{dirty ? " · есть несохранённые правки" : ""}</span>}
        <Button onClick={() => void reload()} disabled={!draft} title="Перечитать с сервера"><RefreshCw size={14} /></Button>
        <Button onClick={handleRepublish} disabled={!draft || dirty} title="Отправить сохранённый набор в automation заново"><Send size={14} /></Button>
        <Button variant="primary" onClick={handleSave} disabled={!draft || !dirty || saving}>
          <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>

      {projectErrors.length > 0 && (
        <div className="shrink-0 px-4 py-2 text-sm bg-red-500/10 text-red-700 dark:text-red-300 space-y-0.5">
          {projectErrors.map((e, i) => <div key={i}>{e.field}: {e.message}</div>)}
          {hasVariableErrors && (
            <div>
              Переменные правятся в разделе{" "}
              <Link href="/data" className="underline">«Данные проекта» → «Переменные»</Link>.
            </div>
          )}
        </div>
      )}

      {!draft ? (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">
          {projectId == null ? "Выберите проект" : "Загрузка…"}
        </div>
      ) : tab === "tasks" ? (
        <div className="flex-1 min-h-0 flex">
          <div className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-2 space-y-1">
            {draft.tasks.map((t, i) => {
              const status = statusOf(t);
              return (
                <button
                  key={t.id ?? `new-${i}`}
                  onClick={() => setSelected(i)}
                  className={cn("w-full text-left px-3 py-2 rounded-lg text-sm", i === selected ? "bg-indigo-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
                >
                  <div className={cn("truncate", taskErrors(t.name).length > 0 && "text-red-600 dark:text-red-400")}>{t.name}</div>
                  {status && !dirty && <div className={cn("mt-1 inline-block px-1.5 rounded text-[11px]", TASK_STATE_VIEW[status.state]?.className)}>{TASK_STATE_VIEW[status.state]?.label ?? status.state}</div>}
                </button>
              );
            })}
            <Button className="w-full" onClick={() => { update({tasks: [...draft.tasks, newTask(draft.tasks.length + 1)]}); setSelected(draft.tasks.length); }}>
              <Plus size={14} />Задача
            </Button>
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto">
            {task ? (
              <TaskEditor
                task={task}
                variables={draft.variables}
                errors={taskErrors(task.name)}
                onChange={t => updateTask(selected, t)}
                onDelete={() => { update({tasks: draft.tasks.filter((_, i) => i !== selected)}); setSelected(0); }}
                onSaveAsTemplate={handleSaveAsTemplate}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-neutral-500">Задач нет</div>
            )}
          </div>
          <TemplatePalette onInsert={handleInsertTemplate} />
        </div>
      ) : tab === "watchdog" ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <WatchdogEditor watchdog={draft.watchdog} errors={projectErrors} onChange={watchdog => update({watchdog})} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <VersionHistoryList versions={versions} currentVersion={draft.version} dirty={dirty} onRestore={v => void handleRestore(v)} />
        </div>
      )}
    </div>
  );
}
