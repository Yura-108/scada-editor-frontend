import {create} from "zustand";

/** Период, по которому реально ушёл запрос (значения полей `datetime-local`). */
export interface LogsRange {
  from: string;
  to: string;
}

/**
 * Форма поиска журнала — клиентское состояние, сами записи грузит Query (`useLogs`).
 * Живёт в сторе, а не в странице: при возвращении на /log форма и показанный период
 * остаются прежними.
 */
interface LogsFilterState {
  fromDate: string;
  toDate: string;
  /** Фильтр по пользователю среди загруженного, без нового запроса. */
  searchQuery: string;
  /** Отправленный период; `null` — запроса ещё не было. */
  submitted: LogsRange | null;
  /** Ошибка проверки формы (до запроса). Ошибку сервера отдаёт Query. */
  validationError: string | null;

  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setSearchQuery: (query: string) => void;
  /**
   * Проверяет период и делает его отправленным. Возвращает `false`, если период тот же,
   * что уже отправлен, — тогда вызывающий перечитывает его сам («Показать» всегда идёт на сервер).
   */
  submit: () => boolean;
}

export const useLogsFilterStore = create<LogsFilterState>((set, get) => ({
  fromDate: "",
  toDate: "",
  searchQuery: "",
  submitted: null,
  validationError: null,

  setFromDate: date => set({fromDate: date}),
  setToDate: date => set({toDate: date}),
  setSearchQuery: query => set({searchQuery: query}),

  submit: () => {
    const {fromDate, toDate, submitted} = get();
    if (!fromDate || !toDate) {
      set({validationError: "Пожалуйста, выберите начальную и конечную дату."});
      return true;
    }
    // Перевёрнутый диапазон бэкенд молча возвращал пустым, и это выглядело
    // как «за период ничего не происходило».
    if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
      set({validationError: "Начальная дата позже конечной — проверьте диапазон."});
      return true;
    }
    if (submitted && submitted.from === fromDate && submitted.to === toDate) {
      set({validationError: null});
      return false;
    }
    set({submitted: {from: fromDate, to: toDate}, validationError: null});
    return true;
  },
}));
