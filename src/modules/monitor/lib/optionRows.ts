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
