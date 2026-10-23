"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Loader2, RefreshCw} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {
  formatTs, journalBadge, journalFilterBar, journalInput as inputClass, journalPage, journalTableBox, journalTbody,
  journalTd, journalTh, journalThead, JournalEmptyRow, JournalField, JournalPresets, JournalTitle, toLocalInput,
} from "@/components/journal/journalUi";
import {useEditorStore} from "@/modules/editor";
import {shortTagPath} from "@/lib/editor/tagPath";
import {
  ACTION_KIND_LABEL, fetchActionLog, type ActionKind, type ActionLogFilter, type ActionLogRecord,
} from "@/lib/runtime/actionLog";

const PAGE_SIZE = 100;

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
  // Действие с аргументами (выбор из меню `showMenu`): имя скрипта и что выбрали.
  if (r.kind === "ACTION" && r.tags?.length) {
    return (
      <div>
        <span>{r.target ?? "—"}</span>
        <ul className="space-y-0.5">
          {r.tags.map((t, i) => (
            <li key={i} className="font-mono text-xs">
              {t.arg ?? "?"} = {typeof t.value === "object" && t.value !== null ? JSON.stringify(t.value) : String(t.value)}
            </li>
          ))}
        </ul>
      </div>
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
    <div className={journalPage}>
      {/* Каркас — как у остальных разделов: заголовок и фильтры под шапкой, список прокручивается. */}
        <JournalTitle
          title="Журнал действий"
          description="Нажатия операторов в мониторе, управление процедурами и ручные записи тегов"
        />
        <form
          className={journalFilterBar}
          onSubmit={e => { e.preventDefault(); apply(); }}
        >
          <JournalField label="С">
            <input type="datetime-local" className={inputClass} value={draftFrom} onChange={e => setDraftFrom(e.target.value)} />
          </JournalField>
          <JournalField label="По">
            <input type="datetime-local" className={inputClass} value={draftTo} onChange={e => setDraftTo(e.target.value)} />
          </JournalField>
          <JournalField label="Проект">
            <select
              className={inputClass}
              value={projectId ?? ""}
              onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Все проекты</option>
              {projectList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </JournalField>
          <JournalField label="Вид">
            <select className={inputClass} value={kind} onChange={e => setKind(e.target.value as ActionKind | "")}>
              <option value="">Все</option>
              {(Object.keys(ACTION_KIND_LABEL) as ActionKind[]).map(k => (
                <option key={k} value={k}>{ACTION_KIND_LABEL[k]}</option>
              ))}
            </select>
          </JournalField>
          <JournalField label="Пользователь">
            <input
              className={inputClass}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="точное имя"
            />
          </JournalField>
          <Button type="submit" variant="primary" className="px-3 py-1.5 text-sm shadow-none" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Показать
          </Button>
          <JournalPresets onPick={applyPreset} />
        </form>

        {error && (
          <div className="shrink-0 px-4 py-2 text-sm bg-red-500/10 text-red-700 dark:text-red-300">{error}</div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto space-y-4">

        <div className={journalTableBox}>
          <table className="w-full text-sm">
            <thead className={journalThead}>
              <tr>
                <th className={journalTh}>Время</th>
                <th className={journalTh}>Пользователь</th>
                <th className={journalTh}>Проект</th>
                <th className={journalTh}>Вид</th>
                <th className={journalTh}>Компонент</th>
                <th className={journalTh}>Что сделано</th>
                <th className={journalTh}>Результат</th>
              </tr>
            </thead>
            <tbody className={journalTbody}>
              {rows.map((r, i) => (
                <tr key={`${r.ts}-${i}`} className="align-top">
                  <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{formatTs(r.ts)}</td>
                  <td className={journalTd}>{r.username ?? "—"}</td>
                  <td className={journalTd}>{projectName(r.projectId)}</td>
                  <td className={`${journalTd} whitespace-nowrap`}>{ACTION_KIND_LABEL[r.kind as ActionKind] ?? r.kind}</td>
                  <td className={journalTd}>{r.component ?? "—"}</td>
                  <td className={journalTd}><ActionTarget r={r} /></td>
                  <td className={journalTd}>
                    {r.outcome === "OK" ? (
                      <span className={journalBadge("ok")}>OK</span>
                    ) : (
                      <div className="space-y-1">
                        <span className={journalBadge("error")}>
                          {r.outcome === "ERROR" ? "Ошибка" : r.outcome}
                        </span>
                        {r.error && <div className="text-xs text-red-600 dark:text-red-400 break-words">{r.error}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && <JournalEmptyRow colSpan={7}>За выбранный период действий нет</JournalEmptyRow>}
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
    </div>
  );
}
