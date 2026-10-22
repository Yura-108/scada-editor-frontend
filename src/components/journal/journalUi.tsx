import React from "react";
import {cn} from "@/shared/lib/cn";

/**
 * Общий вид журналов — «Журнал действий» и «Логирование». Страницы показывают разные записи,
 * но выглядят и управляются одинаково: панель фильтров с подписями над полями, кнопка
 * «Показать», быстрые периоды и таблица в рамке.
 */

export const JOURNAL_PRESETS: {label: string; ms: number}[] = [
  {label: "1 ч", ms: 3600_000},
  {label: "24 ч", ms: 24 * 3600_000},
  {label: "7 дней", ms: 7 * 24 * 3600_000},
  {label: "30 дней", ms: 30 * 24 * 3600_000},
];

/** `datetime-local` работает в местном времени без пояса. */
export const toLocalInput = (ts: number) =>
  new Date(ts - new Date(ts).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export const formatTs = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU")}`;
};

export const journalInput = cn(
  "rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900",
  "px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100",
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
);

/** Каркас страницы журнала: под шапкой, на всю высоту. */
export const journalPage =
  "fixed inset-0 top-(--app-header-h) flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100";

/** Панель фильтров — форма в строку под заголовком журнала. */
export const journalFilterBar =
  "shrink-0 flex flex-wrap items-end justify-center gap-3 px-4 pt-1 pb-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80";

export const journalTableBox =
  "overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";
export const journalThead = "bg-neutral-50 dark:bg-neutral-800/60 text-left text-xs uppercase tracking-wide text-neutral-500";
export const journalTh = "px-3 py-2";
export const journalTbody = "divide-y divide-neutral-100 dark:divide-neutral-800";
export const journalTd = "px-3 py-2";

/** Бейдж статуса в ячейке: «OK», «Ошибка», вид операции. */
export const journalBadge = (tone: "ok" | "error" | "warn" | "neutral") =>
  cn(
    "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
    tone === "ok" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    tone === "error" && "bg-red-500/15 text-red-600 dark:text-red-400",
    tone === "warn" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    tone === "neutral" && "bg-neutral-500/10 text-neutral-600 dark:text-neutral-300",
  );

/**
 * Заголовок журнала — отдельной строкой над панелью фильтров. В одной строке с полями
 * он смотрелся как ещё один фильтр и пропадал на узком окне.
 */
export function JournalTitle({title, description}: {title: string; description: string}) {
  return (
    <div className="shrink-0 px-4 pt-3 pb-1 text-center bg-white dark:bg-neutral-900/80">
      <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}

/** Поле фильтра с подписью над ним. */
export function JournalField({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <label className="space-y-1 text-xs text-neutral-500">
      <span className="block">{label}</span>
      {children}
    </label>
  );
}

/** Быстрые периоды «1 ч / 24 ч / 7 дней / 30 дней». */
export function JournalPresets({onPick}: {onPick: (ms: number) => void}) {
  return (
    <div className="flex gap-1">
      {JOURNAL_PRESETS.map(p => (
        <button
          key={p.label}
          type="button"
          onClick={() => onPick(p.ms)}
          className="rounded-lg px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Строка-заглушка внутри таблицы: пусто, ничего не найдено, ещё не загружали. */
export function JournalEmptyRow({colSpan, children}: {colSpan: number; children: React.ReactNode}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-neutral-500">{children}</td>
    </tr>
  );
}
