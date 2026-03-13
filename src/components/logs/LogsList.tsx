'use client';

import {LogEntry, useLogsStore} from '@/store/useLogsStore';

export default function LogsList() {
  const { logs, isLoading } = useLogsStore();

  if (isLoading) return <div className="text-center py-10">Загрузка логов...</div>;
  if (logs.length === 0) return <div className="text-center py-10 text-gray-500">Нет данных за этот период</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-left border-collapse bg-gray-800">
        <thead>
        <tr className="bg-gray-700 text-gray-300 text-sm uppercase">
          <th className="p-4 font-medium">ID</th>
          <th className="p-4 font-medium">Пользователь</th>
          <th className="p-4 font-medium">Тип сущности</th>
          <th className="p-4 font-medium">Команда</th>
          <th className="p-4 font-medium">Дата</th>
          <th className="p-4 font-medium text-right">Детали</th>
        </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
        {logs.map((log) => (
          <tr key={log.id} className="hover:bg-gray-750 transition-colors">
            <td className="p-4 text-gray-400">#{log.id}</td>
            <td className="p-4 font-semibold text-blue-400">{log.userName}</td>
            <td className="p-4">
                <span className="bg-gray-700 px-2 py-1 rounded text-xs">
                  {log.entityType} ({log.entityId})
                </span>
            </td>
            <td className="p-4">
                <span className={`px-2 py-1 rounded text-xs font-bold ${getCommandStyle(log.commandType)}`}>
                  {log.commandType}
                </span>
            </td>
            <td className="p-4 text-sm text-gray-300">
              {new Date(log.createdAt).toLocaleString('ru-RU')}
            </td>
            <td className="p-4 text-right">
              <button
                onClick={() => console.log(log.payload)} // Здесь можно открыть модалку
                className="text-blue-500 hover:text-blue-400 text-sm underline"
              >
                Просмотр JSON
              </button>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

// Вспомогательная функция для стилей команд
function getCommandStyle(type: LogEntry['commandType']) {
  switch (type) {
    case 'CREATE': return 'bg-green-900/30 text-green-400 border border-green-500/50';
    case 'UPDATE': return 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/50';
    case 'DELETE': return 'bg-red-900/30 text-red-400 border border-red-500/50';
    default: return 'bg-gray-700 text-gray-300';
  }
}