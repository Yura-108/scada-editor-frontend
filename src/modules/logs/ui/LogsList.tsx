'use client';

import {useMemo} from 'react';
import { useLogsSearch } from '../model/useLogsSearch';
import { useLogUndo } from '../model/useLogUndo';
import {useParamTypeName} from "../model/useParamTypeName";
import {groupLogs} from "../lib/groupLogs";
import {
  journalTableBox, journalTbody, journalTh, journalThead, JournalEmptyRow,
} from './journalUi';
import {LogRow} from "./LogRow";
import {LogBatchRows} from "./LogBatchRows";

const COLUMNS = 7;

/**
 * Таблица логов — тот же вид, что у «Журнала действий». Записи одной операции (`batchId`)
 * собраны под строкой «Операция: N изменений» (#14 п. 4), одиночные — как были.
 */
export default function LogsList() {
  const { logs, filteredLogs, isLoading, hasSearched, searchQuery, refresh } = useLogsSearch();
  const typeName = useParamTypeName();
  const handleUndo = useLogUndo(logs, typeName, refresh);
  const onUndo = (log: Parameters<typeof handleUndo>[0]) => void handleUndo(log);
  const items = useMemo(() => groupLogs(filteredLogs), [filteredLogs]);

  // Три разных пустых состояния вместо одного: до первого запроса, «за период пусто» и
  // «фильтр ничего не нашёл» — раньше все три выглядели одинаково.
  const empty = isLoading && filteredLogs.length === 0 ? 'Загрузка…'
    : !hasSearched ? 'Выберите период и нажмите «Показать»'
    : logs.length === 0 ? 'За выбранный период изменений нет'
    : filteredLogs.length === 0 ? `Ничего не найдено по «${searchQuery}» — записей за период: ${logs.length}`
    : null;

  return (
    <div className={journalTableBox}>
      <table className="w-full text-sm">
        <thead className={journalThead}>
          <tr>
            <th className={journalTh}>Время</th>
            <th className={journalTh}>Пользователь</th>
            <th className={journalTh}>Что изменено</th>
            <th className={journalTh}>Операция</th>
            <th className={journalTh}>№</th>
            <th className={journalTh}>Подробности</th>
            <th className={journalTh} />
          </tr>
        </thead>
        <tbody className={journalTbody}>
          {empty ? (
            <JournalEmptyRow colSpan={COLUMNS}>{empty}</JournalEmptyRow>
          ) : items.map(item => item.kind === 'batch' ? (
            <LogBatchRows key={`batch:${item.batchId}`} logs={item.logs} typeName={typeName} onUndo={onUndo} />
          ) : (
            <LogRow key={item.log.id} log={item.log} typeName={typeName} onUndo={onUndo} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
