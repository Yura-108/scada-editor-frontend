import {VARIABLE_TAG_PREFIX} from "@/types/automation.types";

export type PropertyType = "Тег" | "Глобальный" | "Локальный";

/** Откуда берётся tag_id свойства типа «Тег»: канал из дерева или переменная проекта. */
export type TagSource = "channel" | "variable";

/** Типы переменной automation → типы значения свойства (у свойств словарь свой). */
export const VARIABLE_VALUE_TYPE: Record<string, string> = {bool: "boolean", int: "integer", float: "float", string: "string"};

/** Имя переменной проекта из tag_id вида `@var.<имя>`; null — это не переменная. */
export const variableNameOf = (tagId: string | undefined | null): string | null =>
  tagId?.startsWith(VARIABLE_TAG_PREFIX) ? tagId.slice(VARIABLE_TAG_PREFIX.length) : null;

export const PROPERTY_TYPE_OPTIONS: Array<{value: PropertyType; label: string}> = [
  {value: "Тег", label: "Тег"},
  {value: "Глобальный", label: "Глобальный"},
  {value: "Локальный", label: "Локальный"},
];

export const VALUE_TYPE_OPTIONS: Array<{value: string; label: string}> = [
  {value: "string", label: "string"},
  {value: "integer", label: "integer"},
  {value: "float", label: "float"},
  {value: "boolean", label: "boolean"},
  {value: "date", label: "date"},
];

export const ACCESS_LEVEL_MIN = 0;
export const ACCESS_LEVEL_MAX = 10;
