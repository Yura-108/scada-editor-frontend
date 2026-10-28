"use client";

import React, {useEffect, useState} from "react";
import {Undo2} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {loadVersionContent} from "@/core/project";
import {compactButton} from "./formStyles";
import {
  type AutomationVersionDiff,
  diffVersions,
  setOfVersionContent,
  taskFieldChanges,
  taskSummary,
} from "../lib/automationDraft";
import type {AutomationSet, AutomationTask} from "@/types/automation.types";

export type VersionSet = Pick<AutomationSet, "tasks" | "variables" | "watchdog">;

export const loadAutomationVersion = async (projectId: number, versionNo: number): Promise<VersionSet | null> =>
  setOfVersionContent(await loadVersionContent("automation", projectId, versionNo));

/**
 * Подписи зависят от того, что показываем: прошлое («в версии задачу добавили») или
 * последствия восстановления («задача появится»).
 */
type Wording = "history" | "restore";

const LABELS: Record<Wording, {added: string; changed: string; removed: string}> = {
  history: {added: "добавлена", changed: "изменена", removed: "удалена"},
  restore: {added: "появится", changed: "вернётся", removed: "будет удалена"},
};

interface DiffViewProps {
  diff: AutomationVersionDiff;
  wording?: Wording;
  /** Кнопка «Вернуть» у изменённой и удалённой задачи (только в истории). */
  onReturnTask?: (task: AutomationTask) => void;
  returnTitle?: string;
}

const isEmpty = (diff: AutomationVersionDiff) =>
  !diff.added.length && !diff.removed.length && !diff.changed.length && !diff.watchdogChanged && !diff.variablesChanged;

/** Список изменений набора: задача за задачей, с полями, которые у неё поменялись. */
export function AutomationDiffView({diff, wording = "history", onReturnTask, returnTitle}: DiffViewProps) {
  const labels = LABELS[wording];
  if (isEmpty(diff)) {
    return <p className="text-xs text-neutral-500">{wording === "restore" ? "Набор не изменится." : "Содержимое не отличается от предыдущей версии."}</p>;
  }

  const returnButton = (task: AutomationTask) => onReturnTask && (
    <Button className={compactButton} onClick={() => onReturnTask(task)} title={returnTitle}>
      <Undo2 size={14} />Вернуть
    </Button>
  );

  return (
    <ul className="space-y-2 text-sm">
      {diff.added.map(t => (
        <li key={`a-${t.id}-${t.name}`}>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-emerald-600 dark:text-emerald-400">{labels.added}</span>
            <span className="flex-1 truncate font-medium">{t.name}</span>
          </div>
          <p className="ml-26 text-xs text-neutral-500">{taskSummary(t)}</p>
        </li>
      ))}
      {diff.changed.map(({before, after}) => (
        <li key={`c-${after.id}`}>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-amber-600 dark:text-amber-400">{labels.changed}</span>
            <span className="flex-1 truncate font-medium">{after.name}</span>
            {returnButton(before)}
          </div>
          <ul className="ml-26 list-disc pl-4 text-xs text-neutral-600 dark:text-neutral-400">
            {taskFieldChanges(before, after).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </li>
      ))}
      {diff.removed.map(t => (
        <li key={`r-${t.id}-${t.name}`}>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-red-600 dark:text-red-400">{labels.removed}</span>
            <span className="flex-1 truncate font-medium">{t.name}</span>
            {returnButton(t)}
          </div>
          <p className="ml-26 text-xs text-neutral-500">{taskSummary(t)}</p>
        </li>
      ))}
      {diff.watchdogChanged && <li className="text-xs text-neutral-600 dark:text-neutral-400">Изменён watchdog</li>}
      {diff.variablesChanged && <li className="text-xs text-neutral-600 dark:text-neutral-400">Изменены переменные проекта</li>}
    </ul>
  );
}

/** Всё, что лежит в версии: задачи с основными параметрами и watchdog. */
export function AutomationVersionContent({set}: {set: VersionSet}) {
  return (
    <div className="space-y-1 text-sm">
      {set.tasks.length === 0 && <p className="text-xs text-neutral-500">Задач в версии нет.</p>}
      {set.tasks.map(t => (
        <div key={`${t.id}-${t.name}`} className="flex flex-wrap gap-x-2">
          <span className="font-medium">{t.name}</span>
          <span className="text-xs text-neutral-500 self-center">{taskSummary(t)}</span>
        </div>
      ))}
      <p className="text-xs text-neutral-500 pt-1">
        Watchdog: {set.watchdog ? `${set.watchdog.tag || "тег не задан"}, каждые ${set.watchdog.period_ms} мс` : "выключен"}
      </p>
    </div>
  );
}

interface Props {
  projectId: number;
  versionNo: number;
  /** Версия перед этой; null — это первая версия, сравнивать не с чем. */
  previousNo: number | null;
  /**
   * Вернуть задачу в черновик такой, какой она была до этой версии. Нет — нет права правки.
   * Сохраняет пользователь сам, так что одно изменение откатывается, не трогая остальные.
   */
  onReturnTask?: (task: AutomationTask) => void;
}

/** Раскрытая строка истории: что изменилось в версии и что в ней лежит целиком. */
export function AutomationVersionChanges({projectId, versionNo, previousNo, onReturnTask}: Props) {
  const [state, setState] = useState<{diff: AutomationVersionDiff; set: VersionSet} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadAutomationVersion(projectId, versionNo),
      previousNo != null ? loadAutomationVersion(projectId, previousNo) : null,
    ])
      .then(([current, previous]) => {
        if (cancelled) return;
        if (!current) setError("Не удалось разобрать содержимое версии");
        else setState({diff: diffVersions(previous, current), set: current});
      })
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : "Не удалось загрузить версию"));
    return () => { cancelled = true; };
  }, [projectId, versionNo, previousNo]);

  if (error) return <p className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  if (!state) return <p className="text-xs text-neutral-500">Загрузка…</p>;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">
          {previousNo != null ? `Изменения относительно v${previousNo}` : "Первая версия"}
        </p>
        <AutomationDiffView
          diff={state.diff}
          onReturnTask={onReturnTask}
          returnTitle={`Вернуть задачу в черновик такой, какой она была до v${versionNo}`}
        />
      </div>
      <div>
        <button
          type="button"
          onClick={() => setShowContent(v => !v)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showContent ? "Скрыть содержимое версии" : `Показать всё содержимое v${versionNo}`}
        </button>
        {showContent && <div className="mt-2"><AutomationVersionContent set={state.set} /></div>}
      </div>
    </div>
  );
}
