import {isNumericValueType, type PropertyCreateDto} from "@/core/scene";

/** Общая проверка с инспектором объектов — см. core/scene/tags/valueTypes.ts. */
export const isNumericType = isNumericValueType;

/** Имя свойства для оператора: `label`, а без него — технический `name` из скриптов. */
export const propertyTitle = (p: PropertyCreateDto) => p.label?.trim() || p.name;

/** Строка к записи: свойство, адрес тега и значение, которое уедет в ПЛК. */
export interface WriteRow {
  property: PropertyCreateDto;
  tagId: string;
  value: string;
}

/** «1 значение» / «2 значения» / «5 значений» — для заголовка подтверждения. */
export const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};
