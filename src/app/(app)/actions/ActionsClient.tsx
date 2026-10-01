"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Loader2, RefreshCw} from "lucide-react";
import {cn} from "@/lib/utils";
import {useEditorStore} from "@/store/useEditorStore";
import {shortTagPath} from "@/lib/editor/tagPath";
import {
  ACTION_KIND_LABEL, fetchActionLog, type ActionKind, type ActionLogFilter, type ActionLogRecord,
} from "@/lib/runtime/actionLog";

const PAGE_SIZE = 100;

const PRESETS: {label: string; ms: number}[] = [
  {label: "1 ч", ms: 3600_000},
  {label: "24 ч", ms: 24 * 3600_000},
  {label: "7 дней", ms: 7 * 24 * 3600_000},
  {label: "30 дней", ms: 30 * 24 * 3600_000},
];

/** `datetime-local` работает в местном времени без пояса. */
const toLocalInput = (ts: number) =>
  new Date(ts - new Date(ts).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const formatTs = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU")}`;
};

const inputClass = cn(
  "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900",
  "px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100",
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
);

/** Что именно сделали: имя скрипта, операция процедуры или записанные теги. */
function ActionTarget({r}: {r: ActionLogRecord}) {
  if ((r.kind === "TAG_WRITE" || r.kind === "PROPERTY_WRITE") && r.tags?.length) {
    return (
      <ul className="space-y-0.5">
        {r.tags.map((t, i) => (
          <li key={i} className="font-mono text-xs" title={t.tag ?? `свойство #${t.property}`}>
            {/* Запись свойства из инспектора несёт id свойства, а не тег. */}
            {t.tag ? shortTagPath(t.tag) : `свойство #${t.property ?? "?"}`} = {String(t.value)}
          </li>
        ))}
      </ul>
    );
  }
  return <span>{r.target ?? "—"}</span>;
}

/**
 * Журнал действий оператора: нажатия в мониторе, управление процедурами рецептов и прямые
 * записи тегов из «Опций». Только чтение; фильтры применяются кнопкой, чтобы не слать запрос
 * на каждый символ имени пользователя.
 */
export default function ActionsClient() {
  const projectList = useEditorStore(s => s.projectList);
  const loadProjectList = useEditorStore(s => s.loadProjectList);
  useEffect(() => { void loadProjectList(); }, [loadProjectList]);

  const projectName = useMemo(() => {
    const map = new Map(projectList.map(p => [p.id, p.name] as const));
    return (id: number | null) => (id == null ? "—" : map.get(id) ?? `#${id}`);
  }, [projectList]);

  // Черновик фильтра (поля формы) и применённый фильтр (по нему идут запросы).
  const [openedAt] = useState(() => Date.now());
  const [draftFrom, setDraftFrom] = useState(() => toLocalInput(openedAt - 24 * 3600_000));
  const [draftTo, setDraftTo] = useState(() => toLocalInput(openedAt));
  const [projectId, setProjectId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [kind, setKind] = useState<ActionKind | "">("");

  const [rows, setRows] = useState<ActionLogRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Первый запрос уходит сразу при показе страницы — она и начинается «загружающейся».
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<ActionLogFilter | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  /** Только запрос и разбор ответа; «загрузка» выставляет вызывающий (см. startLoad). */
  const request = useCallback((filter: ActionLogFilter, nextPage: number) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    fetchActionLog(filter, nextPage, PAGE_SIZE, ctrl.signal)
      .then(result => {
        if (ctrl.signal.aborted) return;
        setRows(prev => (nextPage === 0 ? result : [...prev, ...result]));
        setPage(nextPage);
        // Общего числа строк бэкенд не отдаёт: полная страница — значит, может быть ещё.
        setHasMore(result.length === PAGE_SIZE);
      })
      .catch(e => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  const load = useCallback((filter: ActionLogFilter, nextPage: number) => {
    setLoading(true);
    setError(null);
    request(filter, nextPage);
  }, [request]);

  const apply = useCallback((override?: {from: string; to: string}) => {
    const from = new Date(override?.from ?? draftFrom).getTime();
    const to = new Date(override?.to ?? draftTo).getTime();
    if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
      setError("Начало периода должно быть раньше конца");
      return;
    }
    const filter: ActionLogFilter = {from, to, projectId, username, kind};
    filterRef.current = filter;
    load(filter, 0);
  }, [draftFrom, draftTo, projectId, username, kind, load]);

  // Первый показ — последние сутки по всем проектам (фильтр по умолчанию, `loading` уже true).
  //
  // Отмена — из ЭТОГО же эффекта, без флага «уже загружали». Strict Mode в разработке
  // монтирует компонент дважды: с флагом учебное размонтирование обрывало первый запрос,
  // а повторное монтирование нового уже не слало — и `loading` оставался true навсегда
  // (оборванный запрос его не сбрасывает). Так запрос просто уходит заново; уход со
  // страницы по-прежнему обрывает текущий.
  useEffect(() => {
    const filter: ActionLogFilter = {from: openedAt - 24 * 3600_000, to: openedAt};
    filterRef.current = filter;
    request(filter, 0);
    return () => ctrlRef.current?.abort();
  }, [openedAt, request]);

  const applyPreset = useCallback((ms: number) => {
    const now = Date.now();
    const next = {from: toLocalInput(now - ms), to: toLocalInput(now)};
    setDraftFrom(next.from);
    setDraftTo(next.to);
    apply(next);
  }, [apply]);

  return (
    <div className="min-h-app bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-black dark:text-white">Журнал действий оператора</h1>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={e => { e.preventDefault(); apply(); }}
        >
          <label className="space-y-1 text-xs text-gray-500">
            <span className="block">С</span>
            <input type="datetime-local" className={inputClass} value={draftFrom} onChange={e => setDraftFrom(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            <span className="block">По</span>
            <input type="datetime-local" className={inputClass} value={draftTo} onChange={e => setDraftTo(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            <span className="block">Проект</span>
            <select
              className={inputClass}
              value={projectId ?? ""}
              onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Все проекты</option>
              {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            <span className="block">Вид</span>
            <select className={inputClass} value={kind} onChange={e => setKind(e.target.value as ActionKind | "")}>
              <option value="">Все</option>
              {(Object.keys(ACTION_KIND_LABEL) as ActionKind[]).map(k => (
                <option key={k} value={k}>{ACTION_KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            <span className="block">Пользователь</span>
            <input
              className={inputClass}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="точное имя"
            />
          </label>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Показать
          </button>
          <div className="flex gap-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.ms)}
                className="rounded-lg px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{error}</div>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Время</th>
                <th className="px-3 py-2">Пользователь</th>
                <th className="px-3 py-2">Проект</th>
                <th className="px-3 py-2">Вид</th>
                <th className="px-3 py-2">Компонент</th>
                <th className="px-3 py-2">Что сделано</th>
                <th className="px-3 py-2">Результат</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r, i) => (
                <tr key={`${r.ts}-${i}`} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatTs(r.ts)}</td>
                  <td className="px-3 py-2">{r.username ?? "—"}</td>
                  <td className="px-3 py-2">{projectName(r.projectId)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{ACTION_KIND_LABEL[r.kind as ActionKind] ?? r.kind}</td>
                  <td className="px-3 py-2">{r.component ?? "—"}</td>
                  <td className="px-3 py-2"><ActionTarget r={r} /></td>
                  <td className="px-3 py-2">
                    {r.outcome === "OK" ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">OK</span>
                    ) : (
                      <div className="space-y-1">
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                          {r.outcome === "ERROR" ? "Ошибка" : r.outcome}
                        </span>
                        {r.error && <div className="text-xs text-red-600 dark:text-red-400 break-words">{r.error}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    За выбранный период действий нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => filterRef.current && load(filterRef.current, page + 1)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Показать ещё
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
