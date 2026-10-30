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
