"use client";

import React, {useEffect, useState} from "react";
import {loadVersionContent} from "@/core/project";
import {Spinner} from "@/shared/ui/Spinner";
import {
  type DataVersionDiff,
  diffDataVersions,
  isEmptyDataDiff,
  tablesOfVersionContent,
} from "../lib/dataVersionDiff";
import {formatCell} from "../lib/values";
import type {ProjectDataTable} from "@/types/projectData.types";

export const loadDataVersion = async (projectId: number, versionNo: number): Promise<ProjectDataTable[] | null> =>
  tablesOfVersionContent(await loadVersionContent("data", projectId, versionNo));

/** Сколько строк таблицы показывать при просмотре версии: дальше — только счётчик. */
const PREVIEW_ROWS = 10;

type Wording = "history" | "restore";

const LABELS: Record<Wording, {added: string; changed: string; removed: string}> = {
  history: {added: "добавлена", changed: "изменена", removed: "удалена"},
  restore: {added: "появится", changed: "вернётся", removed: "будет удалена"},
};

const tableName = (t: {name: string; title: string | null}) => (t.title ? `${t.title} (${t.name})` : t.name);

const tableSummary = (t: ProjectDataTable) =>
  `колонки: ${t.columns.map(c => `${c.name}: ${c.value_type}`).join(", ") || "нет"} · строк: ${t.rows.length}`;

/** Список изменений таблиц: какие добавлены, удалены и что поменялось в остальных. */
export function DataDiffView({diff, wording = "history"}: {diff: DataVersionDiff; wording?: Wording}) {
  const labels = LABELS[wording];
  if (isEmptyDataDiff(diff)) {
    return <p className="text-xs text-neutral-500">{wording === "restore" ? "Таблицы не изменятся." : "Содержимое не отличается от предыдущей версии."}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {diff.added.map(t => (
        <li key={`a-${t.name}`}>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-xs text-emerald-600 dark:text-emerald-400">{labels.added}</span>
            <span className="font-medium">{tableName(t)}</span>
          </div>
          <p className="ml-26 text-xs text-neutral-500">{tableSummary(t)}</p>
        </li>
      ))}
      {diff.changed.map(t => (
        <li key={`c-${t.name}`}>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-xs text-amber-600 dark:text-amber-400">{labels.changed}</span>
            <span className="font-medium">{tableName(t)}</span>
          </div>
          <ul className="ml-26 list-disc pl-4 text-xs text-neutral-600 dark:text-neutral-400">
            {t.lines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </li>
      ))}
      {diff.removed.map(t => (
        <li key={`r-${t.name}`}>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-xs text-red-600 dark:text-red-400">{labels.removed}</span>
            <span className="font-medium">{tableName(t)}</span>
          </div>
          <p className="ml-26 text-xs text-neutral-500">{tableSummary(t)}</p>
        </li>
      ))}
    </ul>
  );
}

/** Таблицы версии целиком: колонки с типами и первые строки. */
export function DataVersionContent({tables}: {tables: ProjectDataTable[]}) {
  if (!tables.length) return <p className="text-xs text-neutral-500">Таблиц в версии нет.</p>;
  return (
    <div className="space-y-4">
      {tables.map(t => (
        <div key={t.name} className="space-y-1">
          <div className="text-sm font-medium">{tableName(t)}</div>
          {t.description && <p className="text-xs text-neutral-500">{t.description}</p>}
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-100 dark:bg-neutral-800/60">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">key</th>
                  {t.columns.map(c => (
                    <th key={c.name} className="px-2 py-1 text-left font-medium whitespace-nowrap" title={c.title ?? undefined}>
                      {c.name}
                      <span className="ml-1 font-normal text-neutral-500">{c.value_type}{c.required ? ", обяз." : ""}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.slice(0, PREVIEW_ROWS).map(row => (
                  <tr key={row.key} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-2 py-1 font-mono">{row.key}</td>
                    {t.columns.map(c => (
                      <td key={c.name} className="px-2 py-1 max-w-48 truncate">
                        {c.name in row.values ? formatCell(row.values[c.name], c.value_type) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            {t.rows.length === 0 ? "Строк нет" : t.rows.length > PREVIEW_ROWS ? `Показаны ${PREVIEW_ROWS} строк из ${t.rows.length}` : `Строк: ${t.rows.length}`}
          </p>
        </div>
      ))}
    </div>
  );
}

interface Props {
  projectId: number;
  versionNo: number;
  previousNo: number | null;
}

/** Раскрытая строка «Истории таблиц»: изменения относительно предыдущей версии и содержимое. */
export function DataVersionChanges({projectId, versionNo, previousNo}: Props) {
  const [state, setState] = useState<{diff: DataVersionDiff; tables: ProjectDataTable[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadDataVersion(projectId, versionNo), previousNo != null ? loadDataVersion(projectId, previousNo) : null])
      .then(([current, previous]) => {
        if (cancelled) return;
        if (!current) setError("Не удалось разобрать содержимое версии");
        else setState({diff: diffDataVersions(previous, current), tables: current});
      })
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : "Не удалось загрузить версию"));
    return () => { cancelled = true; };
  }, [projectId, versionNo, previousNo]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!state) return <Spinner label="Загрузка…" className="text-xs" />;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1.5">
          {previousNo != null ? `Изменения относительно v${previousNo}` : "Первая версия"}
        </p>
        <DataDiffView diff={state.diff} />
      </div>
      <div>
        <button
          type="button"
          onClick={() => setShowContent(v => !v)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showContent ? "Скрыть содержимое версии" : `Показать таблицы v${versionNo} целиком`}
        </button>
        {showContent && <div className="mt-2"><DataVersionContent tables={state.tables} /></div>}
      </div>
    </div>
  );
}
