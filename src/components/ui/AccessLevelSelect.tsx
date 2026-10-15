"use client";

import React from "react";
import {cn} from "@/lib/utils";
import {MAX_ACCESS_LEVEL, MIN_ACCESS_LEVEL} from "@/types/access.types";

const LEVELS = Array.from({length: MAX_ACCESS_LEVEL - MIN_ACCESS_LEVEL + 1}, (_, i) => MIN_ACCESS_LEVEL + i);

interface Props {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Подпись пустого значения: у скрипта и операции процедуры `null` значит «уровень 1». */
  emptyLabel?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * Уровень доступа 1…10. Выпадающий список, а не число: значений всего десять, а вне
 * диапазона бэкенд отвечает 400 — так ввести недопустимое просто нельзя.
 */
export function AccessLevelSelect({id, value, onChange, emptyLabel = "— (1)", disabled, className}: Props) {
  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled}
      onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className={cn(
        "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm disabled:opacity-50",
        className,
      )}
    >
      {emptyLabel !== null && <option value="">{emptyLabel}</option>}
      {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
    </select>
  );
}
