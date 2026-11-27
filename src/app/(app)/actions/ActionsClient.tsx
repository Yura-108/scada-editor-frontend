'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { PageFrame } from '@/shared/ui/page/PageFrame';
import { PageHeader } from '@/shared/ui/page/PageHeader';
import type { SectionHelp } from '@/shared/ui/page/PageHelp';
import { Spinner } from '@/shared/ui/Spinner';
import { journalFilterBar, JournalField, JournalPresets, toLocalInput } from '@/modules/logs';
import { useEditorStore } from '@/modules/editor';
import {
  ACTION_KIND_LABEL,
  fetchActionLog,
  type ActionKind,
  type ActionLogFilter,
  type ActionLogRecord,
} from '@/modules/monitor';
import { Input } from '@/shared/ui/field/Input';
import { Select } from '@/shared/ui/field/Select';
import { ActionsTable } from './ActionsTable';

const PAGE_SIZE = 100;
const ACTIONS_HELP = {
  title: 'Журнал действий',
  body: (
    <p>
      Здесь записываются действия операторов в мониторе. Выберите период и нужный проект, затем
      нажмите «Показать».
    </p>
  ),
  more: (
    <ul>
      <li>Уточните поиск по виду действия или точному логину оператора.</li>
      <li>
        В строке указано, что сделал оператор и чем закончилось действие, например запись значения
        тега или запуск процедуры.
      </li>
      <li>Изменения настроек устройств и каналов ищите в разделе «Логирование».</li>
    </ul>
  ),
} satisfies SectionHelp;

/**
 * Журнал действий оператора: нажатия в мониторе, управление процедурами рецептов и прямые
 * записи тегов из «Опций». Только чтение; фильтры применяются кнопкой, чтобы не слать запрос
 * на каждый символ имени пользователя.
 */
export default function ActionsClient() {
  const projectList = useEditorStore((s) => s.projectList);
  const loadProjectList = useEditorStore((s) => s.loadProjectList);
  useEffect(() => {
    void loadProjectList();
  }, [loadProjectList]);

  const projectName = useMemo(() => {
    const map = new Map(projectList.map((p) => [p.id, p.name] as const));
    return (id: number | null) => (id == null ? '—' : (map.get(id) ?? `#${id}`));
  }, [projectList]);

  // Черновик фильтра (поля формы) и применённый фильтр (по нему идут запросы).
  const [openedAt] = useState(() => Date.now());
  const [draftFrom, setDraftFrom] = useState(() => toLocalInput(openedAt - 24 * 3600_000));
  const [draftTo, setDraftTo] = useState(() => toLocalInput(openedAt));
  const [projectId, setProjectId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [kind, setKind] = useState<ActionKind | ''>('');

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
      .then((result) => {
        if (ctrl.signal.aborted) return;
        setRows((prev) => (nextPage === 0 ? result : [...prev, ...result]));
        setPage(nextPage);
        // Общего числа строк бэкенд не отдаёт: полная страница — значит, может быть ещё.
        setHasMore(result.length === PAGE_SIZE);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  const load = useCallback(
    (filter: ActionLogFilter, nextPage: number) => {
      setLoading(true);
      setError(null);
      request(filter, nextPage);
    },
    [request],
  );

  const apply = useCallback(
    (override?: { from: string; to: string }) => {
      const from = new Date(override?.from ?? draftFrom).getTime();
      const to = new Date(override?.to ?? draftTo).getTime();
      if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
        setError('Начало периода должно быть раньше конца');
        return;
      }
      const filter: ActionLogFilter = { from, to, projectId, username, kind };
      filterRef.current = filter;
      load(filter, 0);
    },
    [draftFrom, draftTo, projectId, username, kind, load],
  );

  // Первый показ — последние сутки по всем проектам (фильтр по умолчанию, `loading` уже true).
  //
  // Отмена — из ЭТОГО же эффекта, без флага «уже загружали». Strict Mode в разработке
  // монтирует компонент дважды: с флагом учебное размонтирование обрывало первый запрос,
  // а повторное монтирование нового уже не слало — и `loading` оставался true навсегда
  // (оборванный запрос его не сбрасывает). Так запрос просто уходит заново; уход со
  // страницы по-прежнему обрывает текущий.
  useEffect(() => {
    const filter: ActionLogFilter = { from: openedAt - 24 * 3600_000, to: openedAt };
    filterRef.current = filter;
    request(filter, 0);
    return () => ctrlRef.current?.abort();
  }, [openedAt, request]);

  const applyPreset = useCallback(
    (ms: number) => {
      const now = Date.now();
      const next = { from: toLocalInput(now - ms), to: toLocalInput(now) };
      setDraftFrom(next.from);
      setDraftTo(next.to);
      apply(next);
    },
    [apply],
  );

  return (
    <PageFrame>
      {/* Каркас — как у остальных разделов: заголовок и фильтры под шапкой, список прокручивается. */}
      <PageHeader
        title="Журнал действий"
        help={ACTIONS_HELP}
        helpSectionId="actions"
        description="Нажатия операторов в мониторе, управление процедурами и ручные записи тегов"
        alwaysShowTitle
      />
      <form
        className={journalFilterBar}
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <JournalField label="С">
          <Input
            size="sm"
            type="datetime-local"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </JournalField>
        <JournalField label="По">
          <Input
            size="sm"
            type="datetime-local"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </JournalField>
        <JournalField label="Проект">
          <Select
            size="sm"
            className="w-44"
            value={projectId == null ? '' : String(projectId)}
            onValueChange={(v) => setProjectId(v ? Number(v) : null)}
            options={[
              { value: '', label: 'Все проекты' },
              ...projectList.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
        </JournalField>
        <JournalField label="Вид">
          <Select
            size="sm"
            className="w-44"
            value={kind}
            onValueChange={(v) => setKind(v as ActionKind | '')}
            options={[
              { value: '', label: 'Все' },
              ...(Object.keys(ACTION_KIND_LABEL) as ActionKind[]).map((k) => ({
                value: k,
                label: ACTION_KIND_LABEL[k],
              })),
            ]}
          />
        </JournalField>
        <JournalField label="Пользователь">
          <Input
            size="sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="точное имя"
            // Сравнивает сервер, и пока строго (`username = ?`): по части имени и без учёта
            // регистра не ищет (#9 п. 2, передано бэкенду).
            title="Логин целиком, с учётом регистра"
          />
        </JournalField>
        <Button type="submit" variant="primary" size="sm" disabled={loading}>
          {loading ? <Spinner /> : <RefreshCw size={14} />}
          Показать
        </Button>
        <JournalPresets onPick={applyPreset} />
      </form>

      {error && (
        <Banner layout="bar" tone="destructive" icon={CircleAlert}>
          {error}
        </Banner>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <ActionsTable rows={rows} loading={loading} projectName={projectName} />

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => filterRef.current && load(filterRef.current, page + 1)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {loading && <Spinner />}
                Показать ещё
              </button>
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
