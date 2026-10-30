import React from "react";
import {cn} from "@/shared/lib/cn";
import {Field} from "@/shared/ui/field/Field";

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

/** Панель фильтров — форма в строку под шапкой журнала (`PageHeader`). */
export const journalFilterBar =
  "shrink-0 flex flex-wrap items-end justify-center gap-3 px-4 py-3 border-b bg-card";

export const journalTableBox = "overflow-x-auto rounded-xl border bg-card";
export const journalThead = "bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground";
export const journalTh = "px-3 py-2";
export const journalTbody = "divide-y";
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

/** Поле фильтра с подписью над ним. */
/** Поле фильтра журнала: компактная подпись над `Input`/`Select` размера `sm`. */
export function JournalField({label, children}: {label: string; children: React.ReactNode}) {
  return <Field size="sm" label={label} className="space-y-1">{children}</Field>;
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
          className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
      <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground">{children}</td>
    </tr>
  );
}
