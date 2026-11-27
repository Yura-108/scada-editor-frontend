'use client';

import React, { useId, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { EmptyState } from './EmptyState';
import { SearchInput } from './field/SearchInput';
import { fieldBase, fieldSizes } from './field/fieldStyles';
import { usePortalContainer } from './portalContainer';

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  icon: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

const FILTER_FROM = 8;

/** Список множественного выбора с поиском. Стрелки перемещают фокус, пробел меняет выбор. */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
  icon,
  disabled,
  isLoading,
  className,
}: MultiSelectProps) {
  const [filter, setFilter] = useState('');
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const portalContainer = usePortalContainer();
  const query = filter.trim().toLowerCase();
  const visible = options.filter((option) => option.label.toLowerCase().includes(query));
  const focusedIndex = visible.findIndex((option) => option.value === focusedValue);
  const firstSelectedIndex = visible.findIndex((option) => selected.includes(option.value));
  const activeIndex = focusedIndex >= 0 ? focusedIndex : Math.max(firstSelectedIndex, 0);
  const optionId = (index: number) => `${listId}-option-${index}`;

  const labelOf = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;
  const selectedLabel = selected.length ? labelOf(selected[0]) : null;
  const extraCount = selected.length > 1 ? `+${selected.length - 1}` : null;
  const triggerText = isLoading ? 'Загрузка…' : (selectedLabel ?? placeholder);
  const visibleLabel = [triggerText, extraCount].filter(Boolean).join(' ');
  const triggerName =
    visibleLabel.replace(/…$/, '') === label ? label : `${label}: ${visibleLabel}`;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  };

  const onListKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault();
        toggle(visible[activeIndex].value);
        return;
      case 'ArrowDown':
        next = Math.min(activeIndex + 1, visible.length - 1);
        break;
      case 'ArrowUp':
        next = Math.max(activeIndex - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = visible.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setFocusedValue(visible[next].value);
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) {
          setFilter('');
          setFocusedValue(null);
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={triggerName}
          disabled={disabled || isLoading}
          title={selected.length ? selected.map(labelOf).join(', ') : undefined}
          className={cn(
            fieldBase,
            fieldSizes.sm,
            'relative flex items-center gap-2 pl-8 pr-2 text-left cursor-pointer',
            className,
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-primary [&_svg]:size-4"
          >
            {icon}
          </span>
          <span
            className={cn('flex-1 min-w-0 truncate', !selectedLabel && 'text-muted-foreground')}
          >
            {triggerText}
            {extraCount && (
              <span className="ml-1 rounded bg-primary/15 px-1.5 text-xs text-primary-text">
                {extraCount}
              </span>
            )}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>

      <Popover.Portal container={portalContainer}>
        <Popover.Content
          aria-label={label}
          align="start"
          sideOffset={6}
          className="z-dropdown min-w-(--radix-popover-trigger-width) w-72 max-w-[90vw] bg-popover text-popover-foreground border rounded-lg shadow-lg overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {options.length >= FILTER_FROM && (
            <div className="border-b p-2">
              <SearchInput
                size="sm"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowDown' || !listRef.current) return;
                  event.preventDefault();
                  listRef.current.focus();
                }}
                placeholder="Фильтр"
                aria-label={`Фильтр: ${label}`}
              />
            </div>
          )}
          {visible.length === 0 ? (
            <EmptyState
              size="sm"
              className="py-3"
              title={options.length ? 'Ничего не найдено' : 'Нет доступных вариантов'}
            />
          ) : (
            <div
              ref={listRef}
              role="listbox"
              aria-label={label}
              aria-multiselectable="true"
              aria-activedescendant={optionId(activeIndex)}
              tabIndex={0}
              onKeyDown={onListKey}
              className="group/list max-h-72 overflow-y-auto p-1 focus-visible:outline-none"
            >
              {visible.map((option, index) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    id={optionId(index)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => {
                      setFocusedValue(option.value);
                      toggle(option.value);
                      listRef.current?.focus();
                    }}
                    className={cn(
                      'w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors hover:bg-accent',
                      isSelected && 'bg-primary/10 text-primary-text',
                      index === activeIndex &&
                        'group-focus-visible/list:outline-2 group-focus-visible/list:-outline-offset-2 group-focus-visible/list:outline-focus-ring',
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {isSelected && <Check aria-hidden className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          {selected.length > 0 && (
            <div className="flex justify-end px-2 py-1.5 border-t">
              <button
                type="button"
                onClick={() => {
                  listRef.current?.focus();
                  onChange([]);
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden className="size-3.5" />
                Снять всё
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
