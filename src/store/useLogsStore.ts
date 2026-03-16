import {create} from "zustand/react";
import {formatLocalDateTime} from "@/lib/formatLocalDateTime";
import {LogEntry} from "@/types/logs.type";

interface LogsState {
  fromDate: string;
  toDate: string;
  logs: LogEntry[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  clearStore: () => void;
  fetchLogs: () => Promise<void>;

  getFilteredLogs: () => LogEntry[];
}

export const useLogsStore = create<LogsState>((set, get) => ({
    fromDate: '',
    toDate: '',
    logs: [],
    searchQuery: '',
    isLoading: false,
    error: null,
    setFromDate: (date) => set({fromDate: date}),
    setToDate: (date) => set({toDate: date}),
    clearStore: () => set({
      fromDate: '',
      toDate: '',
      logs: [],
      error: null
    }),
    setSearchQuery: (query) => set({searchQuery: query}),
    getFilteredLogs: () => {
      const {logs, searchQuery} = get();

      return logs
        .filter((log) =>
          log.userName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) =>
          // Сортировка от новых к старым (descending)
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },
    fetchLogs: async () => {
      const {fromDate, toDate} = get();

      if (!fromDate || !toDate) {
        set({error: 'Пожалуйста, выберите начальную и конечную дату.'});
        return;
      }

      set({isLoading: true, error: null});

      try {
        const fromISO = formatLocalDateTime(fromDate);
        const toISO = formatLocalDateTime(toDate);

        const queryParams = new URLSearchParams({
          from: fromISO,
          to: toISO,
        }).toString();

        const response = await fetch(`/api/logs?${queryParams}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
        }

        const data = await response.json();
        set({logs: data, isLoading: false});

      } catch (err: any) {
        set({error: err.message, isLoading: false});
      }
    }
  }),
);