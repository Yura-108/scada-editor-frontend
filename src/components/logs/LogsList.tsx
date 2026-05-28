'use client';

import { useLogsStore } from '@/store/useLogsStore';
import { LogEntry } from '@/types/logs.type';
import LogDetailsModal from '@/components/ui/LogDetailsModal';
import { cn } from '@/lib/utils';
import {toast} from "sonner";

export default function LogsList() {
  const { logs, isLoading, getFilteredLogs } = useLogsStore();

  const filteredLogs = getFilteredLogs();

  if (isLoading) {
    return (
      <div className="flex min-h-[180px] items-center justify-center text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Загрузка логов...
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-gray-500">
        <span className="text-5xl opacity-30">📭</span>
        <p>Нет данных за выбранный период</p>
      </div>
    );
  }

  const handleCancel = async (id: number) => {
    try {
      const res = await fetch('/api/logs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Ошибка при попытке отката');
      }

      toast.success(`Действие #${id} успешно отменено!`);

    } catch (err: any) {
      toast.error(err.message || 'Не удалось выполнить отмену');
      console.error('Ошибка при отмене:', err);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800/60 bg-white dark:bg-gray-900/40 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800/80 bg-gray-100 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
            <th className="whitespace-nowrap px-5 py-3.5 font-medium">ID</th>
            <th className="whitespace-nowrap px-5 py-3.5 font-medium">Пользователь</th>
            <th className="whitespace-nowrap px-5 py-3.5 font-medium">Сущность</th>
            <th className="whitespace-nowrap px-5 py-3.5 font-medium">Действие</th>
            <th className="whitespace-nowrap px-5 py-3.5 font-medium">Дата / время</th>
            <th className="whitespace-nowrap px-5 py-3.5 font-medium text-center">Детали</th>
            <th className="whitespace-nowrap px-5 py-3.5 font-medium text-center">Отмена</th>
          </tr>
          </thead>

          <tbody className="divide-y divide-gray-800/40 text-sm text-gray-700 dark:text-gray-300">
          {filteredLogs.map((log) => (
            <tr
              key={log.id}
              className={cn(
                'group transition-colors hover:bg-gray-100 dark:bg-gray-800/40',
                log.commandType === 'DELETE' && 'opacity-75',
              )}
            >
              <td className="px-5 py-4 font-mono text-gray-500">#{log.id}</td>

              <td className="px-5 py-4 font-medium text-blue-400/90 group-hover:text-blue-300">
                {log.userName}
              </td>

              <td className="px-5 py-4">
                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800/70 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-700/60">
                    {log.entityType === 'Node' ? 'Устройство' : 'Параметр'} №{log.entityId}
                  </span>
              </td>

              <td className="px-5 py-4">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                      getCommandBadgeStyle(log.commandType),
                    )}
                  >
                    {log.commandType}
                  </span>
              </td>

              <td className="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-400">
                {new Date(log.createdAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>

              <td className="px-5 py-4 text-center">
                <LogDetailsModal
                  log={log}
                  trigger={
                    <button className="inline-flex items-center gap-1 text-blue-400/80 hover:text-blue-300 hover:underline underline-offset-4 transition-colors">
                      <span className="text-xs">подробнее</span>
                      <span aria-hidden>→</span>
                    </button>
                  }
                />
              </td>

              <td className="px-5 py-4 text-center">
                <button
                  onClick={() => handleCancel(log.id)}
                  className={cn(
                    'inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition-all',
                    'text-red-400/80 hover:bg-red-950/30 hover:text-red-300 active:scale-95',
                  )}
                  title="Отменить действие (если возможно)"
                >
                  Отменить
                </button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getCommandBadgeStyle(type: LogEntry['commandType']) {
  switch (type) {
    case 'CREATE':
      return 'bg-green-950/40 text-green-400 ring-green-500/30';
    case 'UPDATE':
      return 'bg-white dark:bg-[#0f0f1a]mber-950/40 text-amber-400 ring-amber-500/30';
    case 'DELETE':
      return 'bg-red-950/40 text-red-400 ring-red-500/30';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-700';
  }
}

