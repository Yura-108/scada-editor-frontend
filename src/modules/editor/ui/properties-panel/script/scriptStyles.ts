import {cn} from "@/shared/lib/cn";

// Общие классы редакторов скриптов (привязка, событие).

/** Чип над кодом: клик вставляет имя в позицию курсора. */
export const chipClasses = cn(
  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer",
  "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 hover:bg-indigo-900/70 transition-colors",
);
