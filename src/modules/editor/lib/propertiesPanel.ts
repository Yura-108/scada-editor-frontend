import {ElementType, PropertySchema} from "@/core/scene";
import {shapeFields} from "./elementSchema/shapeFields";
import {widgetFields} from "./elementSchema/widgetFields";

/**
 * Справочник типов элементов и полей панели свойств. Сам справочник разложен по
 * `elementSchema/`: типы и их названия, общие поля, поля фигур, поля виджетов. Здесь — вход:
 * импортёры берут всё отсюда, как раньше.
 */
export {elementRegistry, elementTypeLabel, elementTypeLabels, ROTATABLE_TYPES} from "./elementSchema/elementTypes";
export {basePropertySchema, Z_INDEX_FIELD} from "./elementSchema/commonFields";

/** Поля по типу элемента. `Record` по всем типам: забытый тип не соберётся (`tsc`). */
export const elementPropertyMap: Record<ElementType, PropertySchema[]> = {...shapeFields, ...widgetFields};
