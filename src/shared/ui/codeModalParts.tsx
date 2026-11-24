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
    <div className="shrink-0 rounded-xl border border-input overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-accent/60 transition-colors"
      >
        <ChevronRight
          size={14}
          className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        {badge != null && <span className="ml-auto">{badge}</span>}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </div>
  );
}
