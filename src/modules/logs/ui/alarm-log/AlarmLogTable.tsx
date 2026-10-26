"use client";

import React from "react";
// переедет в shared/ui вместе с журналом действий (шаг 8)
import {
  formatTs, journalBadge, journalTableBox, journalTbody, journalTd, journalTh, journalThead, JournalEmptyRow,
} from "@/components/journal/journalUi";
import type {AlarmLogEvent, AlarmLogRecord} from "../../alarmLog.types";
import {ALARM_EVENT_LABEL, alarmPriorityTone} from "../../lib/alarmLog";

interface AlarmLogTableProps {
  rows: readonly AlarmLogRecord[];
  loading: boolean;
  projectName: (id: number | null) => string;
}

export function AlarmLogTable({rows, loading, projectName}: AlarmLogTableProps) {
  return (
    <div className={journalTableBox}>
      <table className="w-full text-sm">
        <thead className={journalThead}>
          <tr>
            <th className={journalTh}>Время</th>
            <th className={journalTh}>Проект</th>
            <th className={journalTh}>Контроллер</th>
            <th className={journalTh}>Группа</th>
            <th className={journalTh}>Событие</th>
            <th className={journalTh}>Сообщение</th>
            <th className={journalTh}>Пользователь</th>
          </tr>
        </thead>
        <tbody className={journalTbody}>
          {rows.map((r, i) => (
            <tr key={`${r.ts}-${r.controllerId}-${r.key}-${i}`} className="align-top">
              <td className={`${journalTd} whitespace-nowrap tabular-nums`}>{formatTs(r.ts)}</td>
              <td className={journalTd}>{projectName(r.projectId)}</td>
              <td className={`${journalTd} break-all`}>{r.controllerId}</td>
              <td className={journalTd}>
                <span className={journalBadge(alarmPriorityTone(r.priority))}>{r.group}</span>
              </td>
              <td className={journalTd}>{ALARM_EVENT_LABEL[r.event as AlarmLogEvent] ?? r.event}</td>
              <td className={journalTd}>
                <div className="break-words">{r.description}</div>
                <div className="font-mono text-xs text-neutral-500">{r.key}</div>
              </td>
              {/* null — подтвердили в другом месте (старый монитор) или авария ушла сама. */}
              <td className={journalTd}>{r.username ?? "—"}</td>
            </tr>
          ))}
          {!rows.length && !loading && <JournalEmptyRow colSpan={7}>За выбранный период событий нет</JournalEmptyRow>}
        </tbody>
      </table>
    </div>
  );
}
