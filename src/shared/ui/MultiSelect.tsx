import React, {useMemo, useState} from "react";
import * as Popover from '@radix-ui/react-popover';
import {Check, ChevronDown, Search, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {fieldBase, fieldSizes} from "./field/fieldStyles";
import {EmptyState} from "./EmptyState";
import {usePortalContainer} from "./portalContainer";

interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  icon: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  /** id внешней подписи: триггер — кнопка, `htmlFor` её не подписывает. */
  labelId?: string;
  className?: string;
}

/** С какого числа вариантов в списке появляется фильтр: проектов на площадке бывают десятки. */
const FILTER_FROM = 8;

/**
 * Выбор нескольких значений в одну строку — для панелей инструментов. Выбранные значения
 * в триггере сокращаются до первого и «+N», полный список — в выпадающем окне.
 */
export const MultiSelect = ({options, selected, onChange, placeholder, icon, disabled, isLoading, labelId, className}: MultiSelectProps) => {
  const [filter, setFilter] = useState("");
  const portalContainer = usePortalContainer();

  const toggleOption = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const labelOf = (value: string) => options.find((o) => o.value === value)?.label || value;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, filter]);

  return (
    <Popover.Root onOpenChange={(open) => { if (!open) setFilter(""); }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-labelledby={labelId}
          disabled={disabled || isLoading}
          title={selected.length ? selected.map(labelOf).join(", ") : undefined}
          className={cn(
            fieldBase, fieldSizes.sm,
            "relative flex items-center gap-2 pl-8 pr-2 text-left cursor-pointer",
            className,
          )}
        >
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-primary [&_svg]:w-4 [&_svg]:h-4">
            {icon}
          </span>
          <span className="flex-1 min-w-0 truncate">
            {isLoading ? <span className="text-muted-foreground animate-pulse">Загрузка…</span>
              : selected.length === 0 ? <span className="text-muted-foreground">{placeholder}</span>
              : <>
                  {labelOf(selected[0])}
                  {selected.length > 1 && <span className="ml-1 px-1.5 rounded bg-primary/15 text-primary text-xs">+{selected.length - 1}</span>}
                </>}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>

      <Popover.Portal container={portalContainer}>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-dropdown min-w-(--radix-popover-trigger-width) w-72 max-w-[90vw] bg-popover text-popover-foreground border rounded-lg shadow-lg overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {options.length >= FILTER_FROM && (
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Фильтр"
                aria-label="Фильтр вариантов"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <EmptyState size="sm" className="py-3" title={options.length ? "Ничего не найдено" : "Нет доступных вариантов"} />
            ) : (
              visible.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  // Настоящая кнопка с aria-pressed: раньше это был div, и список
                  // выбора был недоступен ни с клавиатуры, ни скринридеру.
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      "w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                      isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="flex justify-end px-2 py-1.5 border-t">
              <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />Снять всё
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
