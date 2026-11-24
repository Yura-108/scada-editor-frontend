"use client";

import React from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {handleTabListKey} from "@/shared/lib/tabListKeys";

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  /** На вкладке есть несохранённые правки — точка после подписи. */
  dirty?: boolean;
  title?: string;
}

/** Id вкладки, на которую ссылается её панель (`aria-labelledby`). */
export const tabId = (id: string, value: string) => `${id}-tab-${value}`;

/**
 * Атрибуты панели под вкладками с `id`: `<div {...tabPanelProps("left", tab)}>`. Вкладки
 * ссылаются на неё через `aria-controls`, она на активную вкладку — через `aria-labelledby`.
 */
export const tabPanelProps = (id: string, value: string) => ({
  id: `${id}-panel`,
  role: "tabpanel" as const,
  "aria-labelledby": tabId(id, value),
});

/**
 * Полоса вкладок: разделы страницы («Таблицы / Переменные / История»), вкладки панели
 * свойств, «Палитра / Слои». Настоящие вкладки — `role="tablist"`/`"tab"`, одна остановка
 * Tab на полосу, дальше стрелками, Home и End.
 *
 * Сами панели рисует владелец. `id` нужен, только если панель одна и стоит рядом:
 * тогда `tabPanelProps` связывает её с вкладками для скринридера.
 *
 * `stretch` — вкладки делят ширину поровну (узкая панель); раскладку сеткой задаёт `className`.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  id,
  stretch = false,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: readonly TabItem<T>[];
  id?: string;
  stretch?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const values = items.map(item => item.value);

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex items-center gap-1", className)}>
      {items.map(({value: itemValue, label, icon: Icon, dirty, title}) => {
        const selected = itemValue === value;
        return (
          <button
            key={itemValue}
            type="button"
            role="tab"
            id={id ? tabId(id, itemValue) : undefined}
            aria-selected={selected}
            aria-controls={id ? `${id}-panel` : undefined}
            tabIndex={selected ? 0 : -1}
            title={title}
            onClick={() => onValueChange(itemValue)}
            onKeyDown={(e) => handleTabListKey(e, values, value, onValueChange)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
              stretch && "flex-1 justify-center",
              selected
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {label}
            {dirty && (
              <span className="text-warning" title="Есть несохранённые изменения">
                •<span className="sr-only"> (есть несохранённые изменения)</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
