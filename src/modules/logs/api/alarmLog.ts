import {useInfiniteQuery} from "@tanstack/react-query";
import type {AlarmLogFilter, AlarmLogRecord} from "../alarmLog.types";
import {ALARM_LOG_PAGE_SIZE} from "../lib/alarmLog";
// переедет в core/access вместе с правами (шаг 8)
import {errorTextFromJson} from "@/lib/access/accessErrors";

export const alarmLogKeys = {
  all: ["alarm-log"] as const,
  filter: (f: AlarmLogFilter) => ["alarm-log", f.from, f.to, f.projectId, f.group, f.event] as const,
};

/** Одна страница журнала аварий, новые сверху. */
export async function fetchAlarmLog(
  filter: AlarmLogFilter,
  page: number,
  signal?: AbortSignal,
): Promise<AlarmLogRecord[]> {
  const q = new URLSearchParams({
    from: new Date(filter.from).toISOString(),
    to: new Date(filter.to).toISOString(),
    page: String(page),
    size: String(ALARM_LOG_PAGE_SIZE),
  });
  if (filter.projectId != null) q.set("projectId", String(filter.projectId));
  if (filter.group) q.set("group", filter.group);
  if (filter.event) q.set("event", filter.event);

  const res = await fetch(`/api/runtime/alarms/log?${q}`, {signal});
  const data: unknown = await res.json().catch(() => null);
  // Без проекта журнал по всем проектам доступен только администратору — отказ переводим.
  if (!res.ok) throw new Error(errorTextFromJson(res.status, data, `Журнал аварий недоступен (${res.status})`));
  return Array.isArray(data) ? (data as AlarmLogRecord[]) : [];
}

/**
 * Записи по применённому фильтру, страницами по 100. Общего числа строк бэкенд не отдаёт:
 * полная страница — значит, может быть ещё. Сам не перечитывается — только по «Показать».
 */
export function useAlarmLog(filter: AlarmLogFilter | null) {
  return useInfiniteQuery({
    queryKey: filter ? alarmLogKeys.filter(filter) : alarmLogKeys.all,
    queryFn: ({pageParam, signal}) => fetchAlarmLog(filter as AlarmLogFilter, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastPage) => (last.length === ALARM_LOG_PAGE_SIZE ? lastPage + 1 : undefined),
    enabled: filter != null,
    staleTime: Infinity,
  });
}
