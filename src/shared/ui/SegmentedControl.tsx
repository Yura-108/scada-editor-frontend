"use client";

import React from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {toneStyles, type Tone} from "./tone";

export interface SegmentItem<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  title?: string;
  disabled?: boolean;
  /** Цвет выбранного сегмента, если он что-то значит («Архив» — предупреждение). По умолчанию — акцент. */
  tone?: Tone;
}

/**
 * Выбор одного значения из нескольких: окно тренда «5 мин / 1 ч / сутки», режим монитора
 * «Живые данные / Архив». Не вкладки — раздел не меняется, меняется значение, поэтому это
 * `radiogroup`: одна остановка Tab, стрелки выбирают соседнее значение (недоступные пропускаются).
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  items,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: readonly SegmentItem<T>[];
  className?: string;
  "aria-label": string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const enabled = items.filter(item => !item.disabled).map(item => item.value);
    const idx = enabled.indexOf(value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next < 0) return;

    e.preventDefault();
    onValueChange(enabled[next]);
    e.currentTarget.parentElement
      ?.querySelector<HTMLElement>(`[data-value="${CSS.escape(enabled[next])}"]`)
      ?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5", className)}
    >
      {items.map(({value: itemValue, label, icon: Icon, title, disabled, tone = "primary"}) => {
        const selected = itemValue === value;
        return (
          <button
            key={itemValue}
            type="button"
            role="radio"
            data-value={itemValue}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            title={title}
            onClick={() => onValueChange(itemValue)}
            onKeyDown={onKeyDown}
            className={cn(
              "inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? cn(toneStyles[tone].strong, toneStyles[tone].text)
                : "text-muted-foreground enabled:hover:bg-accent enabled:hover:text-foreground",
            )}
          >
            {Icon && <Icon size={12} aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
