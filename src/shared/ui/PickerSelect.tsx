"use client";

import React, {useMemo, useState} from "react";
import * as Popover from "@radix-ui/react-popover";
import {ChevronDown, Search} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {toolbarSelectClassName} from "./selectStyles";

export interface PickerOption {
  value: number;
  label: string;
  /** Пометка после имени: в списке видна, в кнопке — нет (например, «не в эксплуатации»). */
  hint?: string;
}

interface PickerSelectProps {
  value: number | null;
  options: PickerOption[];
  onChange: (value: number) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  /** Кнопки справа в строке. Клик по ним не выбирает строку и не закрывает список. */
  rowActions?: (value: number) => React.ReactNode;
  /** Под списком — например, поле «Создать». */
  footer?: React.ReactNode;
  emptyText?: string;
}

/** С какого числа вариантов появляется фильтр — как в MultiSelect. */
const FILTER_FROM = 8;

/**
 * Выбор одного значения в полосе раздела: проект, схема. Внешне — как прежний нативный
 * `<select>`, но строка списка может нести свои кнопки (в редакторе — выпуски, удаление…),
 * а нативный список вложенных кнопок не умеет.
 */
export function PickerSelect({
  value, options, onChange, placeholder, ariaLabel, disabled, className,
  rowActions, footer, emptyText = "Нет доступных вариантов",
}: PickerSelectProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const selected = options.find(o => o.value === value) ?? null;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  const choose = (v: number) => {
    setOpen(false);
    if (v !== value) onChange(v);
  };

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setFilter(""); }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          title={selected?.label}
          className={cn(
            toolbarSelectClassName,
            "flex items-center gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          )}
        >
          <span className={cn("flex-1 min-w-0 truncate", !selected && "text-neutral-500")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-neutral-500" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-dropdown min-w-(--radix-popover-trigger-width) w-80 max-w-[90vw] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          {options.length >= FILTER_FROM && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
              <Search className="w-4 h-4 shrink-0 text-neutral-400" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Фильтр"
                aria-label="Фильтр вариантов"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <p className="p-3 text-center text-neutral-500 text-sm">{options.length ? "Ничего не найдено" : emptyText}</p>
            ) : (
              visible.map(option => {
                const isSelected = option.value === value;
                return (
                  // Строка — div, выбор — отдельная кнопка: кнопки строки во вложенную кнопку не положить.
                  <div
                    key={option.value}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                      isSelected
                        ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => choose(option.value)}
                      className="min-w-0 flex-1 truncate text-left cursor-pointer"
                    >
                      {option.label}
                      {option.hint && <span className="text-neutral-500"> — {option.hint}</span>}
                    </button>
                    {rowActions?.(option.value)}
                  </div>
                );
              })
            )}
          </div>
          {footer && (
            <div className="px-2 py-2 border-t border-neutral-200 dark:border-neutral-800">{footer}</div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
