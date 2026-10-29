"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {Select} from "@/shared/ui/field/Select";
import type {FieldSize} from "@/shared/ui/field/fieldStyles";
import {MAX_ACCESS_LEVEL, MIN_ACCESS_LEVEL} from "@/types/access.types";

const LEVELS = Array.from({length: MAX_ACCESS_LEVEL - MIN_ACCESS_LEVEL + 1}, (_, i) => MIN_ACCESS_LEVEL + i);

interface Props {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Подпись пустого значения: у скрипта и операции процедуры `null` значит «уровень 1». */
  emptyLabel?: string | null;
  disabled?: boolean;
  size?: FieldSize;
  className?: string;
}

/**
 * Уровень доступа 1…10. Выпадающий список, а не число: значений всего десять, а вне
 * диапазона бэкенд отвечает 400 — так ввести недопустимое просто нельзя.
 */
export function AccessLevelSelect({id, value, onChange, emptyLabel = "— (1)", disabled, size, className}: Props) {
  const options = [
    ...(emptyLabel !== null ? [{value: "", label: emptyLabel}] : []),
    ...LEVELS.map(level => ({value: String(level), label: String(level)})),
  ];
  return (
    <Select
      id={id}
      size={size}
      value={value === null ? "" : String(value)}
      disabled={disabled}
      onValueChange={v => onChange(v === "" ? null : Number(v))}
      options={options}
      className={cn("w-28", className)}
    />
  );
}
