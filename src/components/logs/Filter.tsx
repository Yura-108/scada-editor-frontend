import {useLogsStore} from "@/store/useLogsStore";

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
    <div className="bg-gray-800 p-6 rounded-lg shadow flex flex-col sm:flex-row gap-4 items-end">
      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <label htmlFor="fromDate" className="text-sm text-gray-400">С какого времени:</label>
        <input
          type="datetime-local"
          id="fromDate"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <label htmlFor="toDate" className="text-sm text-gray-400">По какое время:</label>
        <input
          type="datetime-local"
          id="toDate"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        onClick={fetchLogs}
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-6 py-2 rounded transition-colors w-full sm:w-auto"
      >
        {isLoading ? 'Загрузка...' : 'Показать логи'}
      </button>
    </div>
  )
}