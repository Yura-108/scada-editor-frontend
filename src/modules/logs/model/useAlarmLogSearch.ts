import {useCallback, useMemo} from "react";
import type {AlarmLogRecord} from "../alarmLog.types";
import {useAlarmLog} from "../api/alarmLog";
import {useAlarmLogFilterStore} from "./alarmLogFilterStore";

const NO_ROWS: AlarmLogRecord[] = [];

/** Записи журнала аварий по применённому фильтру, «Показать» и «Показать ещё». */
export function useAlarmLogSearch() {
  const submitted = useAlarmLogFilterStore(s => s.submitted);
  const validationError = useAlarmLogFilterStore(s => s.validationError);
  const submit = useAlarmLogFilterStore(s => s.submit);
  const applyPreset = useAlarmLogFilterStore(s => s.applyPreset);
  const query = useAlarmLog(submitted);

  const rows = useMemo(() => query.data?.pages.flat() ?? NO_ROWS, [query.data]);

  /** «Показать»: новый фильтр — новый запрос, тот же — перечитать его. */
  const search = useCallback(() => {
    if (!submit()) void query.refetch();
  }, [submit, query]);

  const preset = useCallback((ms: number) => {
    if (!applyPreset(ms)) void query.refetch();
  }, [applyPreset, query]);

  return {
    rows,
    isLoading: query.isFetching,
    error: validationError ?? (query.isError && !query.isFetching ? query.error.message : null),
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    search,
    preset,
  };
}
