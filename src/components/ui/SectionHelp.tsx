"use client";

import React from "react";
import {Info, X} from "lucide-react";

interface Props {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

/**
 * Плашка «что это за раздел и зачем он нужен» для нового пользователя. Закрывается крестиком,
 * вернуть её можно кнопкой «?» раздела — что именно запоминать, решает владелец.
 */
export function SectionHelp({title, children, onClose}: Props) {
  return (
    <div className="relative rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 px-4 py-3 pr-10 text-sm text-neutral-700 dark:text-neutral-300">
      <div className="flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
        <Info size={16} />{title}
      </div>
      <div className="space-y-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5">{children}</div>
      <button
        type="button"
        onClick={onClose}
        title="Скрыть подсказку"
        aria-label="Скрыть подсказку"
        className="absolute right-2 top-2 p-1 rounded-md text-neutral-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
      >
        <X size={14} />
      </button>
    </div>
  );
}
