"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {Plus, RefreshCw, Save, Send, X} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {useEditorStore, useEditableProject} from "@/modules/editor";
import {useCurrentProjectGrant} from "@/core/access";
import {ProjectPlaceholder} from "@/components/ui/ProjectPlaceholder";
import {ReadOnlyBanner} from "@/components/ui/ReadOnlyBanner";
import {
  AutomationSaveError,
  fetchAutomation,
  fetchAutomationVersions,
  fetchTaskStatuses,
  republishAutomation,
  restoreAutomationVersion,
  saveAutomation,
} from "@/core/automation";
import {TASK_STATE_VIEW} from "@/modules/monitor";
import {
  AutomationDiffView, AutomationVersionChanges, compactButton, diffVersions, findSavedTask, freeTaskName,
  isSetDirty, loadAutomationVersion, missingVariables, openTemplateModal, sameWatchdog, stripIoHints,
  taskDraftState, TaskEditor, tasksWith, taskToTemplate, TemplatePalette, templateToDraftTask,
  WatchdogEditor,
} from "@/modules/automation";
import {VersionHistoryList} from "@/shared/ui/VersionHistoryList";
import {FloatingHelp} from "@/shared/ui/FloatingHelp";
import {UnsavedNotice} from "@/shared/ui/UnsavedNotice";
import {confirmLeave, useUnsavedGuard} from "@/lib/unsavedGuard";
import type {
  AutomationSet,
  AutomationTask,
  AutomationVariable,
  AutomationWatchdog,
  AutomationTaskStatusRow,
  AutomationValidationError,
} from "@/types/automation.types";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";
import type {VersionSummary} from "@/types/editorVersion.types";
import {ProjectSelect} from "@/core/project";

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

const HELP: Record<Tab, {title: string; body: React.ReactNode}> = {
  tasks: {
    title: "Задачи — автоматика, которая работает без оператора",
    body: <>
      <p>
        Задача — небольшой скрипт на JavaScript, который сервер выполняет по кругу с заданным периодом:
        читает входы (теги ПЛК), считает и пишет выходы. Так делают регуляторы, нормализацию сигналов,
        счётчики и блокировки.
      </p>
      <ul>
        <li>Слева — список задач. «+ Задача» создаёт пустую, справа — готовые шаблоны.</li>
        <li>
          Входы и выходы: <b>alias</b> — имя, под которым тег виден в скрипте; <b>тег</b> — путь канала.
          Выберите канал в «Дереве тегов» и нажмите стрелку ← в строке, чтобы подставить его.
        </li>
        <li>Новая задача выключена: отметьте «Включена», когда проверите входы и выходы.</li>
        <li>
          «Сохранить задачу» отправляет только открытую задачу, «Сохранить всё» — все правки сразу.
          Крестик в списке удаляет задачу после подтверждения; удаление можно вернуть.
        </li>
        <li>Плашка под именем — что задача делает на сервере сейчас: «Работает», «Выключена», «Ошибка»…</li>
      </ul>
    </>,
  },
  watchdog: {
    title: "Watchdog — сигнал ПЛК, что автоматика жива",
    body: <p>
      Необязательная настройка. Если включить, сервер будет постоянно менять счётчик в одном теге ПЛК,
      а программа ПЛК по замершему счётчику поймёт, что автоматика остановилась, и переведёт
      оборудование в безопасный режим. Нужен, только если такая проверка заложена в программу ПЛК.
    </p>,
  },
  history: {
    title: "История — все сохранения набора задач",
    body: <ul>
      <li>Каждое сохранение (и удаление задачи) — отдельная версия: кто и когда её сделал.</li>
      <li>Раскройте версию стрелкой — видно, какие задачи в ней добавлены, изменены или удалены.</li>
      <li>«Вернуть» у задачи кладёт её прежний вариант в черновик, остальное не трогает — проверьте и сохраните.</li>
      <li>«Восстановить» откатывает весь набор к этой версии и сразу отправляет его на исполнение.</li>
    </ul>,
  },
};

/** Как часто перечитывать статусы задач: после сохранения automation подхватывает набор не сразу. */
const STATUS_POLL_MS = 5000;

/** Сколько висит уведомление об удалении с кнопкой «Вернуть». */
const UNDO_TOAST_MS = 10_000;

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

  /** Набор, как он лежит на сервере, — основа для сохранения одной задачи и для «изменена». */
  const [saved, setSaved] = useState<AutomationSet | null>(null);
  const [draft, setDraft] = useState<AutomationSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<AutomationValidationError[]>([]);
  const [tab, setTab] = useState<Tab>("tasks");
  const [selected, setSelected] = useState(0);
  const [statuses, setStatuses] = useState<AutomationTaskStatusRow[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  const dirty = useMemo(() => isSetDirty(draft, saved), [draft, saved]);
  // «Вернуть» в уведомлении срабатывает позже — ему нужно текущее состояние, а не то, что
  // было при удалении.
  const latest = useRef({saved, draft});
  useEffect(() => { latest.current = {saved, draft}; });

  const projectId = project?.id ?? null;

  const refreshStatuses = useCallback(async () => {
    if (projectId == null) return;
    setStatuses(await fetchTaskStatuses(projectId));
  }, [projectId]);

  const load = useCallback(async () => {
    // Набор прошлого проекта не должен висеть на экране, пока грузится новый.
    setDraft(null);
    setSaved(null);
    if (projectId == null) return;
    try {
      const [set, rows] = await Promise.all([fetchAutomation(projectId), fetchTaskStatuses(projectId)]);
      setSaved(set);
      setDraft(set);
      setStatuses(rows);
      setErrors([]);
      setSelected(0);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleReload = async () => {
    if (dirty) {
      const ok = await confirmModal({
        title: "Перечитать набор с сервера?",
        description: "Несохранённые правки задач и watchdog пропадут.",
        confirmLabel: "Перечитать",
        danger: true,
      });
      if (!ok) return;
    }
    await load();
  };

  // Статус показывает сервис automation, а он подхватывает сохранённый набор с задержкой.
  useEffect(() => {
    if (tab !== "tasks" || projectId == null) return;
    const timer = setInterval(() => void refreshStatuses(), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [tab, projectId, refreshStatuses]);

  // Перезагрузка страницы молча выбросила бы черновик.
  useEffect(() => {
    if (!dirty || !canWrite) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, canWrite]);

  useEffect(() => {
    if (tab !== "history" || projectId == null) return;
    fetchAutomationVersions(projectId).then(setVersions).catch(err => toast.error((err as Error).message));
  }, [tab, projectId, saved?.version]);

  const update = (patch: Partial<AutomationSet>) => setDraft(d => (d ? {...d, ...patch} : d));

  const updateTask = (index: number, task: AutomationTask) =>
    update({tasks: draft!.tasks.map((t, i) => (i === index ? task : t))});

  /** Выбор после удаления строки `index` из списка длиной `length`. */
  const selectAfterRemoval = (index: number, length: number) =>
    setSelected(sel => (sel > index ? sel - 1 : sel === index ? Math.max(0, Math.min(index, length - 2)) : sel));

  const put = (base: AutomationSet, tasks: AutomationTask[], variables: AutomationVariable[], watchdog: AutomationWatchdog | null) =>
    saveAutomation(projectId!, {
      based_on_version: base.version,
      // example_tag — наша подсказка от шаблона, у задачи на бэкенде такого поля нет.
      tasks: stripIoHints(tasks),
      variables,
      watchdog,
    });

  const reportSaveError = (err: unknown) => {
    if (err instanceof AutomationSaveError && err.errors.length) {
      setErrors(err.errors);
      toast.error(`Набор не прошёл проверку: ${err.errors.length}`);
    } else {
      toast.error((err as Error).message);
    }
  };

  /** `true` — сохранилось: охране ухода надо знать, можно ли уходить. */
  const handleSaveAll = async (): Promise<boolean> => {
    if (!draft || !saved || projectId == null) return false;
    setSaving(true);
    try {
      const result = await put(saved, draft.tasks, draft.variables, draft.watchdog);
      setSaved(result);
      setDraft(result);
      setErrors([]);
      toast.success(`Сохранено, версия ${result.version}`);
      void refreshStatuses();
      return true;
    } catch (err) {
      reportSaveError(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  useUnsavedGuard("automation", {
    label: () => "задачи автоматизации",
    isDirty: () => canWrite && dirty,
    save: handleSaveAll,
  });

  /** Сохранить одну задачу: остальные задачи и watchdog уходят такими, какие они на сервере. */
  const handleSaveTask = async (index: number) => {
    if (!draft || !saved || projectId == null) return;
    const task = draft.tasks[index];
    setSaving(true);
    try {
      const result = await put(saved, tasksWith(saved, task), saved.variables, saved.watchdog);
      const stored = findSavedTask(task, saved, result);
      setSaved(result);
      setDraft(d => d && {
        ...d,
        version: result.version,
        // Если задачу успели поправить, пока шёл запрос, правки оставляем — но с id из ответа,
        // иначе следующее сохранение создало бы её второй раз.
        tasks: d.tasks.map((t, i) => (i !== index || !stored ? t : t === task ? stored : {...t, id: stored.id})),
      });
      setErrors(errs => errs.filter(e => e.task !== task.name.trim() && e.task !== null));
      toast.success(`Задача «${task.name.trim()}» сохранена, версия ${result.version}`);
      void refreshStatuses();
    } catch (err) {
      reportSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRevertTask = (index: number) => {
    const task = draft?.tasks[index];
    const original = task?.id != null ? saved?.tasks.find(t => t.id === task.id) : undefined;
    if (original) updateTask(index, original);
  };

  /** Вернуть удалённую задачу на сервер сразу — удаление тоже было сохранено сразу. */
  const reviveTask = async (task: AutomationTask, atIndex: number) => {
    const {saved: base, draft: current} = latest.current;
    if (!base || !current || projectId == null) return;
    // Id удалённой задачи бэкенд всё равно не узнает и создаст её заново; имя могло уже занять другая.
    const revived = {...task, id: null, name: freeTaskName(task.name, current.tasks.map(t => t.name))};
    setSaving(true);
    try {
      const result = await put(base, [...base.tasks, revived], base.variables, base.watchdog);
      const stored = findSavedTask(revived, base, result) ?? revived;
      setSaved(result);
      setDraft(d => {
        if (!d) return d;
        const tasks = [...d.tasks];
        tasks.splice(Math.min(atIndex, tasks.length), 0, stored);
        return {...d, version: result.version, tasks};
      });
      setSelected(Math.min(atIndex, current.tasks.length));
      toast.success(`Задача «${stored.name}» возвращена, версия ${result.version}`);
      void refreshStatuses();
    } catch (err) {
      reportSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (index: number) => {
    if (!draft || !saved || projectId == null) return;
    const task = draft.tasks[index];
    const state = taskDraftState(task, saved);
    const onServer = state !== "new";
    const ok = await confirmModal({
      title: `Удалить задачу «${task.name.trim() || "без имени"}»?`,
      description: onServer
        ? "Задача сразу удалится с сервера и перестанет исполняться. Вернуть её можно кнопкой "
          + "«Вернуть» в уведомлении или на вкладке «История»."
          + (state === "changed" ? " Несохранённые правки этой задачи пропадут." : "")
          + " Правки других задач останутся черновиком."
        : "Задача ещё не сохранена — она просто исчезнет из списка.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    if (!onServer) {
      setDraft(d => d && {...d, tasks: d.tasks.filter((_, i) => i !== index)});
      selectAfterRemoval(index, draft.tasks.length);
      return;
    }

    const original = saved.tasks.find(t => t.id === task.id) ?? task;
    setSaving(true);
    try {
      const result = await put(saved, saved.tasks.filter(t => t.id !== task.id), saved.variables, saved.watchdog);
      setSaved(result);
      setDraft(d => d && {...d, version: result.version, tasks: d.tasks.filter(t => t.id !== task.id)});
      selectAfterRemoval(index, draft.tasks.length);
      setErrors(errs => errs.filter(e => e.task !== task.name.trim()));
      toast.success(`Задача «${original.name}» удалена, версия ${result.version}`, {
        duration: UNDO_TOAST_MS,
        action: {label: "Вернуть", onClick: () => void reviveTask(original, index)},
      });
      void refreshStatuses();
    } catch (err) {
      reportSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  /** «Вернуть» из истории: задача ложится в черновик, сохраняет пользователь сам. */
  const handleReturnTask = (task: AutomationTask) => {
    if (!draft) return;
    const existing = task.id != null ? draft.tasks.findIndex(t => t.id === task.id) : -1;
    let index: number;
    if (existing >= 0) {
      index = existing;
      updateTask(existing, task);
    } else {
      index = draft.tasks.length;
      update({tasks: [...draft.tasks, {...task, id: null, name: freeTaskName(task.name, draft.tasks.map(t => t.name))}]});
    }
    setSelected(index);
    setTab("tasks");
    toast.info(`Задача «${task.name}» возвращена в черновик`, {
      description: "Проверьте её и нажмите «Сохранить задачу».",
    });
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
    if (projectId == null || !saved) return;
    // Что именно поменяется — до подтверждения, а не после: «v3» само по себе ничего не говорит.
    let preview: React.ReactNode;
    try {
      const target = await loadAutomationVersion(projectId, versionNo);
      preview = target
        ? <AutomationDiffView diff={diffVersions(saved, target)} wording="restore" />
        : <p className="text-xs text-neutral-500">Содержимое версии не удалось разобрать.</p>;
    } catch (err) {
      preview = <p className="text-xs text-red-600">{(err as Error).message}</p>;
    }
    const ok = await confirmModal({
      title: `Восстановить версию ${versionNo}?`,
      description: <div className="space-y-3">
        <p>
          Набор задач заменится содержимым v{versionNo} и сразу уйдёт на исполнение. История не теряется:
          восстановление запишется новой версией. Чтобы вернуть одну задачу, раскройте версию и нажмите «Вернуть» у неё.
        </p>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">Что изменится по сравнению с текущей v{saved.version}</p>
          <div className="max-h-[40vh] overflow-y-auto">{preview}</div>
        </div>
      </div>,
      confirmLabel: "Восстановить",
      danger: true,
      wide: true,
    });
    if (!ok) return;
    try {
      await restoreAutomationVersion(projectId, versionNo);
      await load();
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
  const statusOf = (task: AutomationTask) => (task.id != null ? statuses.find(s => s.taskId === task.id) : undefined);
  const task = draft?.tasks[selected];
  const unsavedCount = draft && saved
    ? draft.tasks.filter(t => taskDraftState(t, saved) !== "saved").length
      + (sameWatchdog(draft.watchdog, saved.watchdog) ? 0 : 1)
    : 0;

  /** Вставка из палитры: в набор кладётся черновик, он уедет сохранением задачи или всего набора. */
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
      {/* В одну строку: название раздела есть в шапке и во вкладке браузера, на узком окне его прячем. */}
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 whitespace-nowrap overflow-x-auto">
        <span className="hidden xl:inline text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Автоматизация</span>
        <ProjectSelect
          projects={projectList}
          value={projectId}
          onChange={async id => {
            const next = projectList.find(p => p.id === id) ?? null;
            // Черновик набора принадлежит проекту: смена проекта его выбрасывает.
            if (await confirmLeave()) setCurrentProject(next);
          }}
        />
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
        {saved?.version != null && <span className="text-xs text-neutral-500" title="Версия сохранённого набора">v{saved.version}</span>}
        <Button className={compactButton} onClick={() => void handleReload()} disabled={!draft || saving} title="Перечитать с сервера"><RefreshCw size={14} /></Button>
        {canWrite ? <>
        <Button className={compactButton} onClick={handleRepublish} disabled={!draft || dirty} title="Отправить сохранённый набор в automation заново"><Send size={14} /></Button>
        <Button
          variant="primary"
          className={compactButton}
          onClick={handleSaveAll}
          disabled={!draft || !dirty || saving}
          title="Сохранить все задачи и watchdog одним набором"
        >
          <Save size={14} />{saving ? "Сохранение…" : unsavedCount > 1 ? `Сохранить всё (${unsavedCount})` : "Сохранить всё"}
        </Button>
        </> : null}
      </div>

      {project && draft && !canWrite && <ReadOnlyBanner projectName={project.name} />}

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

      {!draft || !saved ? (
        projectId == null
          ? <ProjectPlaceholder listLoaded={listLoaded} projectCount={projectList.length} unavailable={unavailable} />
          : <div className="flex-1 flex items-center justify-center text-sm text-neutral-500">Загрузка…</div>
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
                  className={cn("flex items-start rounded-lg", i === selected ? "bg-indigo-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
                >
                  <button onClick={() => setSelected(i)} className="flex-1 min-w-0 text-left px-3 py-2 text-sm">
                    <div className={cn("truncate", taskErrors(t.name).length > 0 && "text-red-600 dark:text-red-400")}>{t.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {/* Статус — то, что исполняет сервер, поэтому он виден и при правках в черновике. */}
                      {status && (
                        <span className={cn("px-1.5 rounded", TASK_STATE_VIEW[status.state]?.className)}>
                          {TASK_STATE_VIEW[status.state]?.label ?? status.state}
                        </span>
                      )}
                      {state === "new" && <span className="px-1.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">не сохранена</span>}
                      {state === "changed" && <span className="px-1.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">изменена</span>}
                    </div>
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => void handleDeleteTask(i)}
                      disabled={saving}
                      title="Удалить задачу"
                      aria-label={`Удалить задачу ${t.name}`}
                      className="m-1.5 p-1 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
            {canWrite && (
              <Button className={cn(compactButton, "w-full")} onClick={() => { update({tasks: [...draft.tasks, newTask(draft.tasks.length + 1)]}); setSelected(draft.tasks.length); }}>
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
                onChange={t => updateTask(selected, t)}
                draftState={taskDraftState(task, saved)}
                onSave={canWrite ? () => void handleSaveTask(selected) : undefined}
                onRevert={canWrite ? () => handleRevertTask(selected) : undefined}
                saving={saving}
                onSaveAsTemplate={handleSaveAsTemplate}
                readOnly={!canWrite}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-neutral-500">Задач нет</div>
            )}
          </div>
          <TemplatePalette onInsert={canWrite ? handleInsertTemplate : undefined} />
        </div>
        </div>
      ) : tab === "watchdog" ? (
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
          <WatchdogEditor watchdog={draft.watchdog} errors={projectErrors} onChange={watchdog => update({watchdog})} readOnly={!canWrite} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pb-24">
          <VersionHistoryList
            versions={versions}
            currentVersion={saved.version}
            dirty={dirty}
            onRestore={canWrite ? v => void handleRestore(v) : undefined}
            renderDetails={(v, previous) => projectId != null && (
              <AutomationVersionChanges
                projectId={projectId}
                versionNo={v.version_no}
                previousNo={previous?.version_no ?? (v.version_no > 1 ? v.version_no - 1 : null)}
                onReturnTask={canWrite ? handleReturnTask : undefined}
              />
            )}
          />
        </div>
      )}

      {canWrite && dirty && (
        <UnsavedNotice
          details={unsavedCount > 0 ? `Не сохранено изменений: ${unsavedCount}. Задачу можно сохранить отдельно — кнопкой в её редакторе.` : undefined}
          onSave={() => void handleSaveAll()}
          onDiscard={() => void handleReload()}
          saving={saving}
        />
      )}
      {draft && <FloatingHelp storageKey="help.automation" title={HELP[tab].title}>{HELP[tab].body}</FloatingHelp>}
    </div>
  );
}

