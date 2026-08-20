import {cn} from "@/lib/utils";

/** Триггер выпадающего списка */
export const selectTriggerClassName = cn(
  "flex w-full items-center justify-between gap-2 rounded-xl border",
  "border-neutral-300 dark:border-neutral-600",
  "bg-white dark:bg-neutral-900",
  "px-4 py-3 text-left text-sm font-medium",
  "text-neutral-900 dark:text-neutral-100",
  "shadow-sm outline-none",
  "hover:border-neutral-400 dark:hover:border-neutral-500",
  "hover:bg-neutral-50 dark:hover:bg-neutral-800",
  "focus:border-indigo-500 dark:focus:border-indigo-400",
  "focus:ring-2 focus:ring-indigo-500/25 dark:focus:ring-indigo-400/20",
  "data-[placeholder]:text-neutral-400 dark:data-[placeholder]:text-neutral-500",
  "transition-colors duration-150"
);

/** Панель со списком опций */
export const selectContentClassName = cn(
  "z-dropdown overflow-hidden rounded-xl border shadow-xl",
  "border-neutral-200 dark:border-neutral-700",
  "bg-white dark:bg-neutral-900",
  "text-neutral-900 dark:text-neutral-100",
  "min-w-(--radix-select-trigger-width) max-h-64",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
);

/** Кнопки прокрутки в длинном списке */
export const selectScrollButtonClassName = cn(
  "flex h-8 cursor-default items-center justify-center",
  "bg-neutral-50 dark:bg-neutral-800",
  "text-neutral-500 dark:text-neutral-400"
);

/** Пункт списка */
export const selectItemClassName = cn(
  "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 pr-9 text-sm outline-none",
  "text-neutral-800 dark:text-neutral-200",
  "data-highlighted:bg-indigo-50 data-highlighted:text-indigo-950",
  "dark:data-highlighted:bg-indigo-500/25 dark:data-highlighted:text-white",
  "data-[state=checked]:font-medium",
  "data-[state=checked]:bg-indigo-100/90 data-[state=checked]:text-indigo-900",
  "dark:data-[state=checked]:bg-indigo-500/20 dark:data-[state=checked]:text-indigo-100",
  "transition-colors duration-100"
);

export const selectIconClassName =
  "h-4 w-4 shrink-0 text-neutral-500 opacity-70 dark:text-neutral-400";
