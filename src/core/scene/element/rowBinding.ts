/**
 * Привязка строки таблицы к тегу/локальному параметру хранится прямо в
 * element.properties (без отдельного поля rowBindings). Номер строки — в поле
 * position самого свойства (бэкенд его теперь поддерживает); property_type —
 * обычная классификация ("Тег" | "Локальный"), как у всех остальных свойств.
 */
export const isRowBindingProperty = (p: {position?: number | null}): boolean =>
  typeof p.position === "number";

export const rowOf = (p: {position?: number | null}): number | null =>
  typeof p.position === "number" ? p.position : null;

/** Сортировка строк таблицы по position (свойства без position — в конец). */
export const sortByRow = <T extends {position?: number | null}>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
