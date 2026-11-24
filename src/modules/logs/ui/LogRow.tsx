'use client';

import React from "react";
import {cn} from "@/shared/lib/cn";
import {Badge} from "@/shared/ui/Badge";
import type {Tone} from "@/shared/ui/tone";
// Журнал базы каналов приходит без пояса — это UTC (см. shared/lib/serverTime).
import {formatServerTime} from "@/shared/lib/serverTime";
import type {LogEntry} from "../types/logs.type";
import {logActionLabel, logObjectTitle, parseLogKind, type LogAction, type ParamTypeName} from "../lib/describeLog";
import LogDetailsModal from "./LogDetailsModal";
import {journalTd} from "./journalUi";

const ACTION_TONE: Record<LogAction, Tone> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'destructive',
};

/** Кнопка «Отменить» или отметка «отменено». */
export function UndoCell({log, onUndo, title}: {log: LogEntry; onUndo: (log: LogEntry) => void; title: string}) {
  return log.undoneAt ? (
    <Badge title={`Отменено ${formatServerTime(log.undoneAt)}`}>отменено</Badge>
  ) : (
    <button
      type="button"
      onClick={() => onUndo(log)}
      className="rounded-lg px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
      title={title}
    >
      Отменить
    </button>
  );
}

/**
 * Строка одной записи журнала. Внутри раскрытой операции (`nested`) — с отступом и без
 * «Отменить»: отмена откатывает операцию целиком, кнопка у её заголовка.
 */
export function LogRow({log, typeName, onUndo, nested = false}: {
  log: LogEntry;
  typeName: ParamTypeName;
  onUndo: (log: LogEntry) => void;
  nested?: boolean;
}) {
  const kind = parseLogKind(log);
  const what = kind.target === 'node' ? 'Устройство' : 'Параметр';
  // Путь и тип — из снимка в записи, номер — в подсказке (#14 п. 1).
  const title = logObjectTitle(log, typeName);

  return (
    <tr className={cn('align-top', log.undoneAt && 'opacity-60', nested && 'bg-muted/40')}>
      <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{nested ? '' : formatServerTime(log.createdAt)}</td>
      <td className={journalTd}>{nested ? '' : log.userName || '—'}</td>
      <td className={cn(journalTd, nested && 'pl-8')} title={`${what} №${log.entityId}`}>
        {title ?? `${what} №${log.entityId}`}
      </td>
      <td className={`${journalTd} whitespace-nowrap`}>
        <Badge tone={kind.action && !kind.undo ? ACTION_TONE[kind.action] : 'neutral'}>
          {logActionLabel(kind, log.commandType)}
        </Badge>
      </td>
      <td className={`${journalTd} font-mono text-xs text-muted-foreground`}>#{log.id}</td>
      <td className={journalTd}>
        <LogDetailsModal
          log={log}
          trigger={
            <button type="button" className="text-xs text-primary hover:underline underline-offset-4">
              подробнее
            </button>
          }
        />
      </td>
      <td className={`${journalTd} text-right`}>
        {!nested && <UndoCell log={log} onUndo={onUndo} title="Отменить это изменение" />}
      </td>
    </tr>
  );
}
