'use client';

import { useLogsStore } from '@/store/useLogsStore';

export default function LogFilters() {
  const { searchQuery, setSearchQuery } = useLogsStore();

  return (
    <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-300 dark:border-gray-700">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          🔍
        </span>
        <input
          type="text"
          placeholder="Поиск по имени пользователя..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white pl-10 pr-4 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white underline"
        >
          Сбросить
        </button>
      )}
    </div>
  );
}

