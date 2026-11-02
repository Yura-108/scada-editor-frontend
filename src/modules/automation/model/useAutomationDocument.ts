import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {toast} from "sonner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {
  AutomationSaveError, fetchAutomation, fetchAutomationVersions, fetchTaskStatuses, republishAutomation,
  restoreAutomationVersion, saveAutomation, type AutomationSet, type AutomationTask, type AutomationTaskStatusRow,
  type AutomationValidationError, type AutomationVariable, type AutomationWatchdog,
} from "@/core/automation";
import type {VersionSummary} from "@/core/project";
import {isSetDirty} from "../lib/automationDraft";
import {stripIoHints} from "../lib/automationTemplates";
import {confirmRestoreAutomationVersion} from "../ui/confirmRestoreAutomationVersion";
import type {AutomationTab} from "../ui/automationHelp";

/** Как часто перечитывать статусы задач: после сохранения automation подхватывает набор не сразу. */
const STATUS_POLL_MS = 5000;

/**
 * Набор automation проекта: сохранённый (как на сервере — основа для сохранения одной задачи и
 * для «изменена») и черновик. Загрузка вместе со статусами задач, опрос статусов на вкладке
 * задач, версии на вкладке истории; сохранение всего набора, «Отправить заново», восстановление.
 */
export function useAutomationDocument(projectId: number | null, tab: AutomationTab) {
  const [saved, setSaved] = useState<AutomationSet | null>(null);
  const [draft, setDraft] = useState<AutomationSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<AutomationValidationError[]>([]);
  const [selected, setSelected] = useState(0);
  const [statuses, setStatuses] = useState<AutomationTaskStatusRow[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);

  const dirty = useMemo(() => isSetDirty(draft, saved), [draft, saved]);
  // «Вернуть» в уведомлении срабатывает позже — ему нужно текущее состояние, а не то, что
  // было при удалении.
  const latest = useRef({saved, draft});
  useEffect(() => { latest.current = {saved, draft}; });

  const refreshStatuses = useCallback(async () => {
    if (projectId == null) return;
    setStatuses(await fetchTaskStatuses(projectId));
  }, [projectId]);

  // Набор прошлого проекта не должен висеть на экране, пока грузится новый. Сброс — при смене
  // проекта во время рендера, а не в эффекте (`set-state-in-effect`): эффект только загружает.
  const [loadedFor, setLoadedFor] = useState(projectId);
  if (loadedFor !== projectId) {
    setLoadedFor(projectId);
    setDraft(null);
    setSaved(null);
  }

  const fetchSet = useCallback(
    () => projectId == null ? Promise.resolve() : Promise.all([fetchAutomation(projectId), fetchTaskStatuses(projectId)]).then(
      ([set, rows]) => {
        setSaved(set);
        setDraft(set);
        setStatuses(rows);
        setErrors([]);
        setSelected(0);
      },
      err => { toast.error((err as Error).message); },
    ),
    [projectId],
  );

  useEffect(() => { void fetchSet(); }, [fetchSet]);

  /** Перечитать с сервера: набор пропадает (спиннер), пока не придёт заново. */
  const load = useCallback(async () => {
    setDraft(null);
    setSaved(null);
    await fetchSet();
  }, [fetchSet]);

  const reload = async () => {
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

  useEffect(() => {
    if (tab !== "history" || projectId == null) return;
    fetchAutomationVersions(projectId).then(setVersions).catch(err => toast.error((err as Error).message));
  }, [tab, projectId, saved?.version]);

  const update = (patch: Partial<AutomationSet>) => setDraft(d => (d ? {...d, ...patch} : d));

  const updateTask = (index: number, task: AutomationTask) =>
    update({tasks: draft!.tasks.map((t, i) => (i === index ? task : t))});

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
  const saveAll = async (): Promise<boolean> => {
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

  const republish = async () => {
    if (projectId == null) return;
    try {
      await republishAutomation(projectId);
      toast.success("Набор отправлен в automation заново");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const restore = async (versionNo: number) => {
    if (projectId == null || !saved) return;
    const ok = await confirmRestoreAutomationVersion(projectId, versionNo, saved);
    if (!ok) return;
    try {
      await restoreAutomationVersion(projectId, versionNo);
      await load();
      toast.success(`Версия ${versionNo} восстановлена`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return {
    projectId, saved, setSaved, draft, setDraft, saving, setSaving, errors, setErrors, selected, setSelected,
    statuses, versions, dirty, latest, refreshStatuses, reload, update, updateTask, put, reportSaveError,
    saveAll, republish, restore,
  };
}

export type AutomationDocument = ReturnType<typeof useAutomationDocument>;
