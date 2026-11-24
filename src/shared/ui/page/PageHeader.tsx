import React from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/shared/lib/cn";

/**
 * Шапка раздела — одна строка 48px: название, затем выбор проекта и вкладки (`children`),
 * справа действия (`actions`). Строка не переносится. На узком окне вбок прокручивается только
 * середина, а действия закреплены у правого края: раньше прокручивалась вся строка, и
 * «Сохранить» уезжала за край. Элементы середины не сжимаются (иначе выбор проекта схлопывался
 * до одной стрелки) — не помещаются, значит прокрутка. Название раздела на узком окне прячется:
 * оно есть в шапке приложения и во вкладке браузера.
 * `alwaysShowTitle` — для раздела, где в строке почти ничего нет (администрирование).
 * `className` — для строки с содержимым (например, свой `gap`).
 *
 * Без `actions` строку делит сам владелец (`<div className="flex-1" />` в `children`) — так у
 * монитора, где справа длинный ряд статусов.
 */
export function PageHeader({
  title,
  icon: Icon,
  description,
  actions,
  alwaysShowTitle = false,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** Пояснение к разделу — приглушённо после названия, только на широком окне. */
  description?: React.ReactNode;
  actions?: React.ReactNode;
  alwaysShowTitle?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const shown = alwaysShowTitle ? "flex" : "hidden xl:flex";

  return (
    <div className="flex h-(--page-header-h) shrink-0 items-center gap-3 border-b bg-card px-4">
      <div
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-3 overflow-x-auto whitespace-nowrap [&>*]:shrink-0",
          className,
        )}
      >
        <div className={cn(shown, "items-baseline gap-3")}>
          {Icon && <Icon size={16} aria-hidden className="shrink-0 self-center text-primary" />}
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </div>
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">{actions}</div>}
    </div>
  );
}
