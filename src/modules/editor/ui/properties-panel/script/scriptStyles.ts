import {cn} from "@/shared/lib/cn";

// Общие классы редакторов скриптов (привязка, событие).

/** Чип над кодом: клик вставляет имя в позицию курсора. */
export const chipClasses = cn(
  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full cursor-pointer",
  "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors",
);
