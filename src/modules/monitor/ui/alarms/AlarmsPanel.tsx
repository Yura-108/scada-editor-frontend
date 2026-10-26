"use client";

import React from "react";
import {WifiOff, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {useAlarmGroups, useAlarmsStale, useAlarmsStore} from "../../model/alarmsStore";
import {AlarmGroupCard} from "./AlarmGroupCard";
import {useAckAlarmGroup} from "./useAckAlarmGroup";
import {SMALL_BUTTON} from "./alarmTone";

interface AlarmsPanelProps {
  projectId: number;
  canAck: boolean;
  onClose: () => void;
}

/** Все активные аварии проекта, включая подтверждённые (`ACCEPT`), сгруппированные как окна. */
export function AlarmsPanel({projectId, canAck, onClose}: AlarmsPanelProps) {
  const groups = useAlarmGroups();
  const alarms = useAlarmsStore(s => s.alarms);
  const stale = useAlarmsStale();
  const {ack, isPending} = useAckAlarmGroup(projectId);
  const ackableCount = alarms.filter(a => a.ackable).length;

  return (
    <aside className="absolute right-3 top-3 bottom-3 z-30 w-[420px] max-w-[calc(100%-1.5rem)] flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <span className="flex-1 text-sm font-semibold">Сообщения ПЛК</span>
        {ackableCount > 0 && (
          <button
            type="button"
            disabled={!canAck || isPending}
            onClick={() => ack(alarms)}
            title={canAck ? `Подтвердить все: ${ackableCount}` : "Нет права управления"}
            className={cn(SMALL_BUTTON, "bg-blue-600 text-white hover:bg-blue-500")}
          >
            {isPending ? "Подтверждение…" : "Подтвердить все"}
          </button>
        )}
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>

      {stale && (
        <div className="flex items-center gap-2 mx-3 mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <WifiOff size={14} className="shrink-0" />
          Нет связи с контроллером — список может быть устаревшим
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {groups.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Активных сообщений нет.</p>
        )}
        {groups.map(group => (
          <AlarmGroupCard key={group.groupKey} group={group} projectId={projectId} canAck={canAck} />
        ))}
      </div>
    </aside>
  );
}
