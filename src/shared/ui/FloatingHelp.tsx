"use client";

import React, {useState} from "react";
import {CircleHelp, X} from "lucide-react";
import {IconButton} from "./IconButton";

interface Props {
  /** Ключ запоминания «свёрнуто/развёрнуто» в браузере, например `help.data`. */
  storageKey: string;
  title: string;
  children: React.ReactNode;
}

const readOpen = (key: string): boolean => {
  try {
    // Впервые — открыта: новому пользователю справку надо увидеть, а не искать.
    return localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
};

/**
 * Справка раздела в правом нижнем углу: свёрнутая — круглая кнопка «?», развёрнутая — окно
 * с инструкцией. Состояние помнит браузер. Тосты висят справа сверху, так что угол свободен.
 *
 * Читает localStorage в начальном состоянии, поэтому монтировать её нужно только на клиенте
 * (после загрузки данных страницы), иначе разметка сервера и клиента разойдётся.
 */
export function FloatingHelp({storageKey, title, children}: Props) {
  const [open, setOpen] = useState(() => readOpen(storageKey));

  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // не запомнится между заходами — не страшно
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        title="Справка по разделу"
        aria-label="Справка по разделу"
        className="fixed bottom-4 right-4 z-toolbar flex items-center gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 px-4 py-2.5 text-sm font-medium"
      >
        <CircleHelp size={18} />Справка
      </button>
    );
  }

  return (
    <aside
      aria-label={title}
      className="fixed bottom-4 right-4 z-toolbar w-[min(380px,calc(100vw-2rem))] max-h-[min(60vh,560px)] flex flex-col rounded-2xl border border-primary/20 bg-card shadow-2xl"
    >
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-primary/15 bg-primary/10 rounded-t-2xl">
        <CircleHelp size={16} className="text-primary" />
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        <IconButton icon={X} label="Свернуть справку" onClick={() => toggle(false)} />
      </div>
      <div className="overflow-y-auto px-4 py-3 text-sm text-foreground space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_b]:text-foreground [&_code]:text-xs [&_code]:px-1 [&_code]:rounded [&_code]:bg-muted">
        {children}
      </div>
    </aside>
  );
}
