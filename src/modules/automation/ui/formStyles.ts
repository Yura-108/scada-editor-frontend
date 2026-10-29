/**
 * Классы полей форм раздела «Автоматизация». Были скопированы в TaskEditor, IoTable,
 * VariablesEditor и WatchdogEditor — копии успели разъехаться по отступам.
 */

/** Поле формы в одну колонку. */
export const fieldInput =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm";

/** Подпись над полем. */
export const fieldLabel =
  "block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1";

/** Поле внутри плотной таблицы (входы/выходы, переменные) — отступы меньше. */
export const cellInput =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

/**
 * Кнопка-спутник формы. Размер `Button` по умолчанию рассчитан на подвал модалки: в строке
 * формы он выше полей и забирает ширину у названия.
 */
export const compactButton = "h-8 px-3 text-sm shadow-none whitespace-nowrap";

/** Кнопка-иконка в строке таблицы. */
export const iconButton = "h-8 w-8 px-0 shadow-none";
