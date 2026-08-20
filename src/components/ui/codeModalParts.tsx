"use client";

import React, {ReactNode, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {ChevronRight, HelpCircle} from "lucide-react";
import {cn} from "@/lib/utils";

/**
 * Заголовок модалки с описанием, спрятанным под значок «?».
 * Описание всегда присутствует в DOM (Dialog.Description) ради a11y Radix, но
 * визуально скрыто (sr-only), пока пользователь не раскроет его кликом.
 */
export function TitleWithHint({
  title,
  description,
}: {
  title: ReactNode;
  description: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2 pr-10">
        <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Показать описание"
          title="Показать описание"
          className={cn(
            "rounded-full p-1 transition-colors",
            open
              ? "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400"
              : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10",
          )}
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <Dialog.Description
        className={cn(
          open
            ? "mt-2 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-gray-100 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
            : "sr-only",
        )}
      >
        {description}
      </Dialog.Description>
    </div>
  );
}

/**
 * Сворачиваемая секция: в шапке — стрелка + заголовок, тело раскрывается по клику.
 * Используется для тест-прогона (по умолчанию свёрнут).
 */
export function Collapsible({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="shrink-0 rounded-xl border border-gray-300 dark:border-gray-700/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors"
      >
        <ChevronRight
          size={14}
          className={cn("text-gray-500 transition-transform", open && "rotate-90")}
        />
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</span>
        {badge != null && <span className="ml-auto">{badge}</span>}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}
