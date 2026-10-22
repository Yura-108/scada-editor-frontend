import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {formatLocalDateTime} from "@/shared/lib/formatLocalDateTime";
import type {LogEntry} from "@/types/logs.type";
import type {LogsRange} from "../model/logsFilterStore";

export const logsKeys = {
  all: ["logs"] as const,
  range: (range: LogsRange) => ["logs", range.from, range.to] as const,
};

const fetchLogs = async ({from, to}: LogsRange): Promise<LogEntry[]> => {
  const params = new URLSearchParams({from: formatLocalDateTime(from), to: formatLocalDateTime(to)});
  const response = await fetch(`/api/logs?${params}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/**
 * Записи журнала за отправленный период. Сам по себе не перечитывается (`staleTime: Infinity`):
 * свежие данные — по «Показать» или после отмены записи. Пока грузится новый период, на экране
 * остаются записи прежнего (`keepPreviousData`), как и до перевода на Query.
 */
export function useLogs(range: LogsRange | null) {
  return useQuery({
    queryKey: range ? logsKeys.range(range) : logsKeys.all,
    queryFn: () => fetchLogs(range as LogsRange),
    enabled: range != null,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}
