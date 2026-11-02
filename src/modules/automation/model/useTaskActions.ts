import {toast} from "sonner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import type {AutomationTask} from "@/core/automation";
import {findSavedTask, freeTaskName, newTask, taskDraftState, tasksWith} from "../lib/automationDraft";
import {missingVariables, taskToTemplate, templateToDraftTask} from "../lib/automationTemplates";
import type {AutomationTaskTemplate} from "../types/automationTemplate.types";
import type {AutomationTab} from "../ui/automationHelp";
import {openTemplateModal} from "../ui/OpenTemplateModal";
import type {AutomationDocument} from "./useAutomationDocument";

/** Сколько висит уведомление об удалении с кнопкой «Вернуть». */
const UNDO_TOAST_MS = 10_000;

/**
 * Действия над задачами набора. Сохранение задачи — PUT *сохранённого* набора с заменённой
 * задачей: незаконченные правки соседних остаются черновиком. Удаление сохраняется сразу, после
 * подтверждения, и возвращается из уведомления; задача из истории ложится в черновик.
 */
export function useTaskActions(doc: AutomationDocument, setTab: (tab: AutomationTab) => void) {
  const {
    projectId, saved, setSaved, draft, setDraft, setSaving, setErrors, setSelected, latest, refreshStatuses,
    update, updateTask, put, reportSaveError,
  } = doc;

  /** Выбор после удаления строки `index` из списка длиной `length`. */
  const selectAfterRemoval = (index: number, length: number) =>
    setSelected(sel => (sel > index ? sel - 1 : sel === index ? Math.max(0, Math.min(index, length - 2)) : sel));

  const addTask = () => {
    if (!draft) return;
    update({tasks: [...draft.tasks, newTask(draft.tasks.length + 1)]});
    setSelected(draft.tasks.length);
  };

  /** Сохранить одну задачу: остальные задачи и watchdog уходят такими, какие они на сервере. */
  const saveTask = async (index: number) => {
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

  const revertTask = (index: number) => {
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

  const deleteTask = async (index: number) => {
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
  const returnTask = (task: AutomationTask) => {
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

  /** Вставка из палитры: в набор кладётся черновик, он уедет сохранением задачи или всего набора. */
  const insertTemplate = (template: AutomationTaskTemplate) => {
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

  const saveAsTemplate = (task: AutomationTask | undefined) => {
    if (!task) return;
    openTemplateModal({mode: "create", initial: taskToTemplate(task)});
  };

  return {addTask, saveTask, revertTask, deleteTask, returnTask, insertTemplate, saveAsTemplate};
}
