'use client';

import { useLogsSearch } from '../model/useLogsSearch';
import { LogEntry } from '@/types/logs.type';
import LogDetailsModal from './LogDetailsModal';
import { cn } from '@/shared/lib/cn';
import { toast } from "sonner";
import {
  formatTs, journalTableBox, journalTbody, journalTd, journalTh, journalThead, JournalEmptyRow,
} from './journalUi';
import {useDeviceTreeStore} from "@/core/devices";
import {Badge} from "@/shared/ui/Badge";
import type {Tone} from "@/shared/ui/tone";

const COLUMNS = 7;

const COMMAND_LABEL: Record<LogEntry['commandType'], string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  DELETE: 'Удаление',
};

const COMMAND_TONE: Record<LogEntry['commandType'], Tone> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'destructive',
};

/** Таблица логов — тот же вид, что у «Журнала действий». */
export default function LogsList() {
  const { logs, filteredLogs, isLoading, hasSearched, searchQuery, refresh } = useLogsSearch();

  const handleCancel = async (log: LogEntry) => {
    try {
      const res = log.batchId != null
        ? await fetch(`/api/logs/batch/${log.batchId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        : await fetch('/api/logs/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log.id),
        });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Ошибка при попытке отката');
      }

      toast.success(`Действие #${log.id} успешно отменено!`);
      await refresh();
      // Помечаем базу каналов устаревшей — при следующем входе в /channels она пере-синхронизируется.
      useDeviceTreeStore.getState().markStale();

    } catch (err) {
      toast.error((err instanceof Error && err.message) || 'Не удалось выполнить отмену');
      console.error('Ошибка при отмене:', err);
    }
  };

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
          ) : filteredLogs.map((log) => (
            <tr key={log.id} className={cn('align-top', log.undoneAt && 'opacity-60')}>
              <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{formatTs(log.createdAt)}</td>
              <td className={journalTd}>{log.userName || '—'}</td>
              <td className={journalTd}>
                {log.entityType === 'Node' ? 'Устройство' : 'Параметр'} №{log.entityId}
              </td>
              <td className={`${journalTd} whitespace-nowrap`}>
                <Badge tone={COMMAND_TONE[log.commandType] ?? 'neutral'}>
                  {COMMAND_LABEL[log.commandType] ?? log.commandType}
                </Badge>
              </td>
              <td className={`${journalTd} font-mono text-xs text-neutral-500`}>#{log.id}</td>
              <td className={journalTd}>
                <LogDetailsModal
                  log={log}
                  trigger={
                    <button type="button" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4">
                      подробнее
                    </button>
                  }
                />
              </td>
              <td className={`${journalTd} text-right`}>
                {log.undoneAt ? (
                  <Badge title={`Отменено ${formatTs(log.undoneAt)}`}>отменено</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancel(log)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    title={log.batchId ? 'Отменить всю операцию (все её записи)' : 'Отменить это изменение'}
                  >
                    Отменить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
