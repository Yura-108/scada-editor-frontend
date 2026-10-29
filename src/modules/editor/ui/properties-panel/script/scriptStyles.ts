import {cn} from "@/shared/lib/cn";

// Общие классы редакторов скриптов (привязка, событие).

export const scriptInputClasses = cn(
  "w-full rounded-xl border border-gray-300 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 px-4 py-2.5",
  "text-gray-900 dark:text-gray-100 placeholder:text-gray-500 outline-none",
  "hover:border-gray-400 dark:hover:border-gray-500 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
  "transition-all shadow-sm",
);

/** Чип над кодом: клик вставляет имя в позицию курсора. */
export const chipClasses = cn(
  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer",
  "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 hover:bg-indigo-900/70 transition-colors",
);
