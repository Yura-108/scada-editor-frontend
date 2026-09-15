import type {ProjectDataRow, ProjectDataValueType} from "@/types/projectData.types";

/**
 * Значения ячеек таблиц данных проекта. Чистые функции без React: сетка и редактор колонок
 * только вызывают их.
 *
 * Пустая ячейка — это ОТСУТСТВИЕ ключа в `values`, а не `null`: так бэкенд отличает
 * «не задано» (сработает default_value / required) от явного значения.
 */

/** Результат разбора: `undefined` — ячейка пуста, `error` — текст не приводится к типу. */
export type ParsedCell = {value: unknown} | {value: undefined} | {error: string};

/** Приводит значение к типу колонки; `undefined` — привести нельзя, ячейку надо очистить. */
export const coerceValue = (value: unknown, type: ProjectDataValueType): unknown => {
  if (value === undefined || value === null) return undefined;
  switch (type) {
    case "bool":
      if (typeof value === "boolean") return value;
      if (value === 1 || value === "1" || value === "true") return true;
      if (value === 0 || value === "0" || value === "false") return false;
      return undefined;
    case "int":
    case "float": {
      const n = typeof value === "number" ? value
        : typeof value === "boolean" ? Number(value)
        : typeof value === "string" && value.trim() !== "" ? Number(value)
        : NaN;
      if (!Number.isFinite(n)) return undefined;
      return type === "int" ? Math.trunc(n) : n;
    }
    case "string":
      return typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
    case "json":
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
  }
};

/** Текст ячейки для поля ввода. */
export const formatCell = (value: unknown, type: ProjectDataValueType): string => {
  if (value === undefined || value === null) return "";
  if (type === "json" || typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/** Разбирает текст из поля ввода в значение типа колонки. */
export const parseCell = (text: string, type: ProjectDataValueType): ParsedCell => {
  // Пробелы — осмысленная строка, но пустое число/JSON — просто пустая ячейка.
  if (text === "" || (type !== "string" && text.trim() === "")) return {value: undefined};
  switch (type) {
    case "bool":
      if (text === "true") return {value: true};
      if (text === "false") return {value: false};
      return {error: "ожидается true или false"};
    case "int": {
      const n = Number(text);
      return Number.isInteger(n) ? {value: n} : {error: "ожидается целое число"};
    }
    case "float": {
      const n = Number(text);
      return Number.isFinite(n) ? {value: n} : {error: "ожидается число"};
    }
    case "string":
      return {value: text};
    case "json":
      try {
        return {value: JSON.parse(text)};
      } catch {
        return {error: "невалидный JSON"};
      }
  }
};

/** Кладёт значение в строку; `undefined` удаляет ключ. */
export const setCellValue = (row: ProjectDataRow, column: string, value: unknown): ProjectDataRow => {
  const values = {...row.values};
  if (value === undefined) delete values[column];
  else values[column] = value;
  return {...row, values};
};

export const renameColumnInRows = (rows: ProjectDataRow[], from: string, to: string): ProjectDataRow[] =>
  from === to ? rows : rows.map(row => {
    if (!(from in row.values)) return row;
    const {[from]: value, ...rest} = row.values;
    return {...row, values: {...rest, [to]: value}};
  });

export const dropColumnFromRows = (rows: ProjectDataRow[], column: string): ProjectDataRow[] =>
  rows.map(row => (column in row.values ? setCellValue(row, column, undefined) : row));

/** Смена типа колонки: приводимые значения приводятся, остальные удаляются. */
export const retypeColumnInRows = (rows: ProjectDataRow[], column: string, type: ProjectDataValueType): ProjectDataRow[] =>
  rows.map(row => (column in row.values ? setCellValue(row, column, coerceValue(row.values[column], type)) : row));
