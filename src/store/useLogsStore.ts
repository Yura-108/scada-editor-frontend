import {create} from "zustand/react";
import {formatLocalDateTime} from "@/lib/formatLocalDateTime";

interface LogsState {
  fromDate: string;
  toDate: string;
  logs: LogEntry[];
  isLoading: boolean;
  error: string | null;

  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  clearStore: () => void;
  fetchLogs: () => Promise<void>;
}

export interface LogEntry {
  id: number;
  userName: string;
  entityType: string;
  entityId: number;
  commandType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  undoPayload: any;
  createdAt: string;
}

export const useLogsStore = create<LogsState>((set, get) => ({
  fromDate: '',
  toDate: '',
  logs: [],
  isLoading: false,
  error: null,
  setFromDate: (date) => set({ fromDate: date }),
  setToDate: (date) => set({ toDate: date }),
  clearStore: () => set({
    fromDate: '',
    toDate: '',
    logs: [],
    error: null
  }),
  fetchLogs: async () => {
    const { fromDate, toDate } = get();

    if (!fromDate || !toDate) {
      set({ error: 'Пожалуйста, выберите начальную и конечную дату.' });
      return;
    }

    set({ isLoading: true, error: null });

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
      set({ logs: data, isLoading: false });

    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  }}));