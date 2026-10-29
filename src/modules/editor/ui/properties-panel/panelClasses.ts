import {cn} from "@/shared/lib/cn";
import {fieldBase, fieldSizes} from "@/shared/ui/field/fieldStyles";

/**
 * Поле панели свойств — общее поле `sm` (`shared/ui/field`). Отдельный класс нужен только
 * тем, кто сам рисует `<input>` или оформляет как поле кнопку.
 */
export const baseInputClasses = cn(fieldBase, fieldSizes.sm);

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
