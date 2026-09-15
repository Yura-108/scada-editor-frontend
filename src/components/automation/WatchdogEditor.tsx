"use client";

import React from "react";
import type {AutomationValidationError, AutomationWatchdog} from "@/types/automation.types";

const input = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  watchdog: AutomationWatchdog | null;
  errors: AutomationValidationError[];
  onChange: (watchdog: AutomationWatchdog | null) => void;
}

/** Watchdog проекта: счётчик, который automation пишет в тег ПЛК. */
export function WatchdogEditor({watchdog, errors, onChange}: Props) {
  return (
    <div className="p-4 max-w-4xl">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Watchdog</h3>
        <p className="text-xs text-neutral-500">
          Счётчик 0…65535, который automation пишет в тег ПЛК с заданным периодом. ПЛК по застывшему
          счётчику понимает, что автоматика остановилась, и переходит в безопасный режим.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={watchdog !== null} onChange={e => onChange(e.target.checked ? {tag: "", period_ms: 1000} : null)} />
          Включён
        </label>
        {watchdog && (
          <div className="grid grid-cols-[1fr_160px] gap-2">
            <input className={input} placeholder="путь тега ПЛК" value={watchdog.tag} onChange={e => onChange({...watchdog, tag: e.target.value})} />
            <input className={input} type="number" value={watchdog.period_ms} onChange={e => onChange({...watchdog, period_ms: Math.trunc(Number(e.target.value))})} title="100 … 60 000 мс" />
          </div>
        )}
        {errors.filter(e => e.field.startsWith("watchdog")).map((e, i) => (
          <p key={i} className="text-xs text-red-600">{e.message}</p>
        ))}
      </section>
    </div>
  );
}
