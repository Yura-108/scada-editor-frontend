import {useCallback, useMemo} from "react";
import {useQueryClient} from "@tanstack/react-query";
import type {LogEntry} from "@/types/logs.type";
import {logsKeys, useLogs} from "../api/logs";
import {useLogsFilterStore} from "./logsFilterStore";

const NO_LOGS: LogEntry[] = [];

/**
 * Всё, что нужно странице журнала: записи за отправленный период, их отфильтрованный вид
 * и «Показать». Форма — в `useLogsFilterStore`, записи — в Query.
 */
export function useLogsSearch() {
  const submitted = useLogsFilterStore(s => s.submitted);
  const searchQuery = useLogsFilterStore(s => s.searchQuery);
  const validationError = useLogsFilterStore(s => s.validationError);
  const submit = useLogsFilterStore(s => s.submit);
  const query = useLogs(submitted);
  const queryClient = useQueryClient();

  const logs = query.data ?? NO_LOGS;

  // Поиск по пользователю среди загруженного + сортировка от новых к старым.
  const filteredLogs = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return logs
      .filter(log => log.userName.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs, searchQuery]);

  /** «Показать»: новый период — новый запрос, тот же период — перечитать его. */
  const search = useCallback(() => {
    if (!submit()) void query.refetch();
  }, [submit, query]);

  /** После отмены записи журнал перечитывается — показанный период тоже. */
  const refresh = useCallback(
    () => queryClient.invalidateQueries({queryKey: logsKeys.all}),
    [queryClient],
  );

  return {
    logs,
    filteredLogs,
    searchQuery,
    isLoading: query.isFetching,
    error: validationError ?? (query.isError && !query.isFetching ? query.error.message : null),
    // Как раньше: «искали» — значит, был хотя бы один отправленный период.
    hasSearched: submitted != null,
    search,
    refresh,
  };
}
