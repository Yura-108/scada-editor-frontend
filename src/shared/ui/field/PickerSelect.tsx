"use client";

import React, {useMemo, useRef, useState} from "react";
import * as Popover from "@radix-ui/react-popover";
import {Check, ChevronDown} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {EmptyState} from "../EmptyState";
import {fieldBase, fieldSizes} from "./fieldStyles";
import {SearchInput} from "./SearchInput";

export interface PickerItem {
  value: string;
  label: string;
  /** Значок после названия, например «prod №3». */
  meta?: React.ReactNode;
  /** Кнопки строки — `IconButton size="xs"`: закрепить, выпуски, удалить. */
  actions?: React.ReactNode;
}

/** С какого числа пунктов над списком появляется поиск. */
const SEARCH_FROM = 8;

/**
 * Выпадающий список, в строках которого есть свои кнопки: выбор проекта с выпусками и
 * эксплуатацией, выбор схемы с закреплением и удалением. Закрытый — как `Select` того же
 * размера, поэтому в шапке страницы стоит с ним вровень.
 *
 * `Select` для этого не годится: его пункт сам интерактивный, и кнопку в него не вложить.
 * Здесь строка — кнопка выбора и рядом кнопки действий; стрелки ходят по строкам, Enter
 * выбирает, Esc закрывает. Открытием можно управлять снаружи (`open`/`onOpenChange`) —
 * чтобы закрыть список перед окном, которое открывает кнопка строки, или раскрыть
 * следующий список после выбора в этом.
 */
export function PickerSelect({
  value,
  onValueChange,
  items,
  placeholder,
  valueLabel,
  emptyText = "Ничего нет",
  disabled = false,
  open,
  onOpenChange,
  className,
  title,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onValueChange: (value: string) => void;
  items: readonly PickerItem[];
  placeholder: string;
  /** Подпись выбранного, когда его нет среди пунктов (схема чужого проекта). */
  valueLabel?: string;
  emptyText?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  title?: string;
  "aria-label": string;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const searchable = items.length >= SEARCH_FROM;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(item => item.label.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const current = items.find(item => item.value === value)?.label ?? valueLabel;
  const options = () => [...(listRef.current?.querySelectorAll<HTMLElement>("[data-picker-option]") ?? [])];

  // Стрелки — между кнопками выбора строк; кнопки действий доступны по Tab.
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = options();
    if (!all.length) return;
    e.preventDefault();
    const idx = all.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (idx + 1) % all.length : (idx - 1 + all.length) % all.length;
    all[idx < 0 ? 0 : next]?.focus();
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={next => { setOpen(next); if (!next) setQuery(""); }}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel}
          title={title ?? current}
          className={cn(
            fieldBase, fieldSizes.sm,
            "flex min-w-0 items-center gap-2 text-left disabled:cursor-not-allowed",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !current && "text-muted-foreground")}>{current ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          // Фокус — на выбранную строку (или на поиск), а не на первую попавшуюся кнопку.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            requestAnimationFrame(() => {
              const target = searchable
                ? listRef.current?.parentElement?.querySelector<HTMLElement>("input")
                : options().find(o => o.dataset.value === value) ?? options()[0];
              target?.focus();
            });
          }}
          className={cn(
            "z-dropdown w-(--radix-popover-trigger-width) min-w-72 max-w-[90vw] overflow-hidden rounded-lg border",
            "bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        >
          {searchable && (
            <div className="border-b p-2">
              <SearchInput
                size="sm"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Найти"
                aria-label={`Найти: ${ariaLabel}`}
              />
            </div>
          )}
          <div ref={listRef} onKeyDown={onListKey} className="max-h-80 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <EmptyState size="sm" className="py-3" title={items.length ? "Ничего не найдено" : emptyText} />
            ) : visible.map(item => {
              const selected = item.value === value;
              return (
                <div
                  key={item.value}
                  className={cn("flex items-center gap-1 rounded-md pr-1", selected ? "bg-primary/10" : "hover:bg-accent")}
                >
                  <button
                    type="button"
                    data-picker-option
                    data-value={item.value}
                    aria-current={selected || undefined}
                    onClick={() => { onValueChange(item.value); setOpen(false); setQuery(""); }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                  >
                    <Check className={cn("h-4 w-4 shrink-0 text-primary", !selected && "invisible")} aria-hidden />
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.meta}
                  </button>
                  {item.actions && <div className="flex shrink-0 items-center gap-0.5">{item.actions}</div>}
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
