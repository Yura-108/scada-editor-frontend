import { useLogsStore } from "@/store/useLogsStore";

export default function Filter() {
  const {
    fromDate,
    toDate,
    isLoading,
    setFromDate,
    setToDate,
    fetchLogs
  } = useLogsStore();

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 items-end">
      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <label
          htmlFor="fromDate"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          С какого времени:
        </label>
        <input
          type="datetime-local"
          id="fromDate"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-white dark:bg-gray-950
                     border border-gray-300 dark:border-gray-700
                     text-gray-900 dark:text-gray-100
                     focus:border-blue-500 dark:focus:border-blue-500
                     focus:ring-1 focus:ring-blue-500
                     px-4 py-2.5 rounded-lg transition-colors
                     disabled:bg-gray-100 dark:disabled:bg-gray-900"
        />
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <label
          htmlFor="toDate"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          По какое время:
        </label>
        <input
          type="datetime-local"
          id="toDate"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-white dark:bg-gray-950
                     border border-gray-300 dark:border-gray-700
                     text-gray-900 dark:text-gray-100
                     focus:border-blue-500 dark:focus:border-blue-500
                     focus:ring-1 focus:ring-blue-500
                     px-4 py-2.5 rounded-lg transition-colors
                     disabled:bg-gray-100 dark:disabled:bg-gray-900"
        />
      </div>

      <button
        onClick={fetchLogs}
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                   disabled:bg-gray-300 dark:disabled:bg-gray-700
                   text-white disabled:text-gray-500
                   px-6 py-2.5 rounded-lg font-medium transition-all
                   w-full sm:w-auto flex items-center justify-center"
      >
        {isLoading ? 'Загрузка...' : 'Показать логи'}
      </button>
    </div>
  )
}