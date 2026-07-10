'use client';

import Filter from "@/components/logs/Filter";
import {useLogsStore} from "@/store/useLogsStore";
import LogsList from "@/components/logs/LogsList";
import LogFilters from "@/components/logs/FilterLogs";

export default function LogsPage() {
  const {error} = useLogsStore();
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold text-black dark:text-white">Логи базы каналов</h1>

        {/* Панель управления (фильтры) */}
        <Filter />

        <LogFilters />

        {/* Отображение ошибок */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Отображение результатов */}
        <LogsList />
      </div>
    </div>
  );
}

