"use client";

import React from "react";
import {Bell} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {useAlarmBadge} from "../../model/alarmsStore";
import {TONE_VIEW} from "./alarmTone";

interface AlarmsBadgeProps {
  open: boolean;
  onToggle: () => void;
}

/** Кнопка шапки: число аварий, ждущих подтверждения, цвет — по самой важной из них. */
export function AlarmsBadge({open, onToggle}: AlarmsBadgeProps) {
  const {count, tone} = useAlarmBadge();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      className={cn(
        "flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
        tone ? TONE_VIEW[tone].pill : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-500/20",
      )}
      title={count > 0 ? `Сообщений ПЛК ждут подтверждения: ${count}` : "Сообщения ПЛК"}
    >
      <Bell size={14} />
      <span className="hidden xl:inline">Сообщения</span>
      {count > 0 && <span><span className="hidden xl:inline">: </span>{count}</span>}
    </button>
  );
}
