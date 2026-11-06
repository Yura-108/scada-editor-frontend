'use client';

import { useLogsSearch } from '../model/useLogsSearch';
import { useLogUndo } from '../model/useLogUndo';
import LogDetailsModal from './LogDetailsModal';
import { cn } from '@/shared/lib/cn';
import {
  journalTableBox, journalTbody, journalTd, journalTh, journalThead, JournalEmptyRow,
} from './journalUi';
import {Badge} from "@/shared/ui/Badge";
// Журнал базы каналов приходит без пояса — это UTC (см. shared/lib/serverTime).
import {formatServerTime} from "@/shared/lib/serverTime";
import type {Tone} from "@/shared/ui/tone";
import {logActionLabel, logObjectTitle, parseLogKind, type LogAction} from "../lib/describeLog";
import {useParamTypeName} from "../model/useParamTypeName";

const COLUMNS = 7;

const ACTION_TONE: Record<LogAction, Tone> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'destructive',
};

/** Таблица логов — тот же вид, что у «Журнала действий». */
export default function LogsList() {
  const { logs, filteredLogs, isLoading, hasSearched, searchQuery, refresh } = useLogsSearch();
  const typeName = useParamTypeName();

  const handleCancel = useLogUndo(logs, typeName, refresh);

  // Три разных пустых состояния вместо одного: до первого запроса, «за период пусто» и
  // «фильтр ничего не нашёл» — раньше все три выглядели одинаково.
  const empty = isLoading && filteredLogs.length === 0 ? 'Загрузка…'
    : !hasSearched ? 'Выберите период и нажмите «Показать»'
    : logs.length === 0 ? 'За выбранный период изменений нет'
    : filteredLogs.length === 0 ? `Ничего не найдено по «${searchQuery}» — записей за период: ${logs.length}`
    : null;

  return (
    <div className={journalTableBox}>
      <table className="w-full text-sm">
        <thead className={journalThead}>
          <tr>
            <th className={journalTh}>Время</th>
            <th className={journalTh}>Пользователь</th>
            <th className={journalTh}>Что изменено</th>
            <th className={journalTh}>Операция</th>
            <th className={journalTh}>№</th>
            <th className={journalTh}>Подробности</th>
            <th className={journalTh} />
          </tr>
        </thead>
        <tbody className={journalTbody}>
          {empty ? (
            <JournalEmptyRow colSpan={COLUMNS}>{empty}</JournalEmptyRow>
          ) : filteredLogs.map((log) => {
            const kind = parseLogKind(log);
            const what = kind.target === 'node' ? 'Устройство' : 'Параметр';
            // Путь и тип — из снимка в записи, номер — мелко в подсказке (#14 п. 1): по одному
            // «Параметр №…» нельзя было понять, что поменяли.
            const title = logObjectTitle(log, typeName);
            return (
            <tr key={log.id} className={cn('align-top', log.undoneAt && 'opacity-60')}>
              <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{formatServerTime(log.createdAt)}</td>
              <td className={journalTd}>{log.userName || '—'}</td>
              <td className={journalTd} title={`${what} №${log.entityId}`}>
                {title ?? `${what} №${log.entityId}`}
              </td>
              <td className={`${journalTd} whitespace-nowrap`}>
                <Badge tone={kind.action && !kind.undo ? ACTION_TONE[kind.action] : 'neutral'}>
                  {logActionLabel(kind, log.commandType)}
                </Badge>
              </td>
              <td className={`${journalTd} font-mono text-xs text-muted-foreground`}>#{log.id}</td>
              <td className={journalTd}>
                <LogDetailsModal
                  log={log}
                  trigger={
                    <button type="button" className="text-xs text-primary hover:underline underline-offset-4">
                      подробнее
                    </button>
                  }
                />
              </td>
              <td className={`${journalTd} text-right`}>
                {log.undoneAt ? (
                  <Badge title={`Отменено ${formatServerTime(log.undoneAt)}`}>отменено</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancel(log)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
                    title={log.batchId ? 'Отменить всю операцию (все её записи)' : 'Отменить это изменение'}
                  >
                    Отменить
                  </button>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
