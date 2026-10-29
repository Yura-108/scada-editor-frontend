"use client";

import React, {ReactNode, useState} from "react";
import {ChevronRight} from "lucide-react";
import {cn} from "@/shared/lib/cn";

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
