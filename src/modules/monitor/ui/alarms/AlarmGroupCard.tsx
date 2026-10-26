"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {alarmTone, formatAlarmTime, type AlarmGroup} from "../../lib/alarms";
import {dismissAlarms} from "../../model/alarmsStore";
import {useAckAlarmGroup} from "./useAckAlarmGroup";
import {SMALL_BUTTON, TONE_VIEW} from "./alarmTone";

interface AlarmGroupCardProps {
  group: AlarmGroup;
  projectId: number;
  /** Право `operate` в проекте. */
  canAck: boolean;
  /** Всплывающее окно: есть «Закрыть», скрывающее его у себя. */
  popup?: boolean;
}

/** Группа одинаковых аварий: текст, «×N», время, группа и кнопки. */
export function AlarmGroupCard({group, projectId, canAck, popup}: AlarmGroupCardProps) {
  const {ack, isPending} = useAckAlarmGroup(projectId);
  const {latest} = group;
  const tone = TONE_VIEW[alarmTone(group.priority)];
  const accepted = group.alarms.every(a => a.state === "ACCEPT");
  const suppressed = group.alarms.some(a => a.suppressed);

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-4 pr-3 py-2.5 space-y-1.5 shadow-sm">
      <span className={cn("absolute left-0 top-0 bottom-0 w-1.5", tone.stripe)} />
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm break-words">{latest.description}</p>
        {group.alarms.length > 1 && (
          <span
            className={cn("shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold", tone.pill)}
            title={`Одинаковых сообщений: ${group.alarms.length}`}
          >
            ×{group.alarms.length}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{formatAlarmTime(latest.since)}</span>
        <span>· {latest.group}</span>
        {accepted && <span>· подтверждена, причина ещё есть</span>}
        {suppressed && <span className="text-amber-600 dark:text-amber-400">· подавлена</span>}
      </div>
      <div className="flex justify-end gap-2 pt-0.5">
        {group.ackable.length > 0 && (
          <button
            type="button"
            disabled={!canAck || isPending}
            onClick={() => ack(group.alarms)}
            title={canAck ? undefined : "Нет права управления"}
            className={cn(SMALL_BUTTON, "bg-blue-600 text-white hover:bg-blue-500")}
          >
            {isPending ? "Подтверждение…" : "Подтвердить"}
          </button>
        )}
        {popup && (
          <button
            type="button"
            onClick={() => dismissAlarms(group.alarms)}
            title="Скрыть окно. В ПЛК ничего не уходит — сообщение остаётся в списке"
            className={cn(SMALL_BUTTON, "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700")}
          >
            Закрыть
          </button>
        )}
      </div>
    </div>
  );
}
