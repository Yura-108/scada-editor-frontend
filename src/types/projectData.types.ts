/** Контракт «Данных проекта» (docs/contract/2026-09-15-project-data-contract.md). */

export type ProjectDataValueType = "bool" | "int" | "float" | "string" | "json";

export const PROJECT_DATA_VALUE_TYPES: ProjectDataValueType[] = ["bool", "int", "float", "string", "json"];

/** Шаблон имени таблицы и колонки — тот же, что проверяет бэкенд. */
export const PROJECT_DATA_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Имя колонки, занятое ключом строки. */
export const RESERVED_COLUMN_NAME = "key";

export interface ProjectDataColumn {
  name: string;
  title: string | null;
  value_type: ProjectDataValueType;
  required: boolean;
  /** Строкой, как у переменных проекта. */
  default_value: string | null;
}

export interface ProjectDataRow {
  /** Непустой, уникальный в таблице. */
  key: string;
  /** Значение в типе колонки. Пустая ячейка — ключа нет вовсе, а не null. */
  values: Record<string, unknown>;
}

export interface ProjectDataTable {
  name: string;
  title: string | null;
  description: string | null;
  columns: ProjectDataColumn[];
  rows: ProjectDataRow[];
}

export interface ProjectDataSet {
  project_id: number;
  /** null — набор ещё не сохраняли. */
  version: number | null;
  tables: ProjectDataTable[];
}

export interface ProjectDataSaveRequest {
  /** Обязателен, если version !== null; для несохранённого набора поле не шлётся вовсе. */
  based_on_version?: number;
  tables: ProjectDataTable[];
}

export interface ProjectDataValidationError {
  /** null — нарушение уровня набора (например, предел 1 МБ). */
  table: string | null;
  /** name, columns.name, columns.value_type, columns.default_value, rows.key, rows.values, tables. */
  field: string;
  message: string;
}
