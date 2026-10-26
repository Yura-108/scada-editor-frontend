import {cn} from "@/shared/lib/cn";

/** Общие классы полей и кнопок панели свойств. */
export const baseInputClasses = cn(
  "w-full bg-white/80 dark:bg-neutral-900/80 border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm",
  "text-gray-900 dark:text-neutral-100 placeholder:text-gray-500 dark:placeholder:text-neutral-600",
  "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
  "transition-all duration-200 hover:border-gray-400 dark:hover:border-neutral-600"
);

export const baseAddButtonClasses = cn(
  "flex items-center gap-2 py-2",
  "hover:underline hover:scale-105",
  "rounded-xl",
  "text-sm font-medium",
  "text-gray-800 dark:text-gray-200",
  "transition-all duration-200",
  "active:scale-95"
);

export const tabButtonClasses = (isActive: boolean) => cn(
  "flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200",
  "border border-gray-300 dark:border-neutral-700",
  isActive
    ? "bg-blue-600/40 text-blue-200 border-blue-500/50 dark:bg-blue-600/70 dark:text-blue-100 dark:border-blue-500/70"
    : "bg-gray-100/40 text-gray-600 hover:bg-gray-200/60 hover:text-gray-500 dark:bg-neutral-900/40 dark:text-neutral-400 hover:dark:bg-neutral-800/60 hover:dark:text-neutral-300"
);
