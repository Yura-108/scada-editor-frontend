'use client';

import React, {useState} from "react";
import {ChevronDown, ChevronRight} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {IconButton} from "@/shared/ui/IconButton";
import {formatServerTime} from "@/shared/lib/serverTime";
import {countOf} from "@/shared/lib/plural";
import type {LogEntry} from "../types/logs.type";
import type {ParamTypeName} from "../lib/describeLog";
import {journalTd} from "./journalUi";
import {LogRow, UndoCell} from "./LogRow";

/**
 * Операция — записи одного действия (`batchId`) под одной строкой «Операция: N изменений»
 * (#14 п. 4). Раньше они шли отдельными строками, а связь была видна только по подсказке
 * кнопки. Свёрнута по умолчанию; «Отменить» — у заголовка, откатывает всю операцию.
 */
export function LogBatchRows({logs, typeName, onUndo}: {
  logs: LogEntry[];
  typeName: ParamTypeName;
  onUndo: (log: LogEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const first = logs[0];
  const allUndone = logs.every(l => l.undoneAt);
  const head = logs.find(l => !l.undoneAt) ?? first;
  const users = [...new Set(logs.map(l => l.userName).filter(Boolean))].join(", ");

  return (
    <>
      <tr className={cn('align-top', allUndone && 'opacity-60')}>
        <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{formatServerTime(first.createdAt)}</td>
        <td className={journalTd}>{users || '—'}</td>
        <td className={journalTd} colSpan={4}>
          <span className="inline-flex items-center gap-1">
            <IconButton
              icon={open ? ChevronDown : ChevronRight}
              label={open ? "Свернуть операцию" : "Показать изменения операции"}
              size="xs"
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            />
            <button type="button" className="font-medium hover:underline underline-offset-4" onClick={() => setOpen(v => !v)}>
              Операция: {countOf(logs.length, 'изменение', 'изменения', 'изменений')}
            </button>
          </span>
        </td>
        <td className={`${journalTd} text-right`}>
          <UndoCell log={head} onUndo={onUndo} title="Отменить всю операцию — все её изменения" />
        </td>
      </tr>
      {open && logs.map(log => (
        <LogRow key={log.id} log={log} typeName={typeName} onUndo={onUndo} nested />
      ))}
    </>
  );
}
