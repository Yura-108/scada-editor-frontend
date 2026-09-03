import type { CellBinding, CellSourceField, TagBinding } from "@/types/binding.types";
import type { DiagramElement } from "@/types/editorElement.type";
import type { PropertyCreateDto } from "@/types/tags.types";
import { cellRuntimeKey, getCellData } from "@/lib/editor/tableCells";

/**
 * Привязки ячеек таблицы: какое поле какого свойства попадает в какую ячейку.
 *
 * Свойства висят на таблице целиком (`element.properties`), а раскладку по ячейкам
 * задаёт пользователь. Пришло на смену жёсткой конвенции «строка = свойство с
 * `position`, колонка 0 — номер, колонка 1 — имя, колонка 2 — значение», из-за которой
 * таблица была не таблицей, а трёхколоночным списком с нередактируемыми колонками.
 *
 * Свойство адресуется ИМЕНЕМ: `propertyId` нестабилен между пересохранениями таблицы,
 * и по имени же ходят рецепты (`property_name`) и кадр WS (`propertyName`).
 */

/** Поля свойства для выбора в панели. `value` — живое, остальные статические. */
export const CELL_SOURCE_FIELDS: {value: CellSourceField; label: string}[] = [
  {value: "value", label: "Значение (живое)"},
  {value: "name", label: "Имя"},
  {value: "tag_id", label: "Тег"},
  {value: "value_type", label: "Тип значения"},
  {value: "property_type", label: "Тип свойства"},
  {value: "default_value", label: "Значение по умолчанию"},
  {value: "description", label: "Описание"},
];

/**
 * Через рантайм идёт только живое значение. Остальные поля лежат в самом свойстве и
 * рисуются одинаково в редакторе и в мониторе — им рантайм не нужен вовсе.
 */
export const isLiveField = (field: CellSourceField): boolean => field === "value";

/** Все привязки-ячейки элемента (в порядке объявления). */
export function cellBindings(el: DiagramElement): {binding: TagBinding; cell: CellBinding}[] {
  const result: {binding: TagBinding; cell: CellBinding}[] = [];
  for (const binding of el.bindings ?? []) {
    if (binding.cell) result.push({binding, cell: binding.cell});
  }
  return result;
}

/** Привязка конкретной ячейки, если она есть. */
export function cellBindingAt(el: DiagramElement, row: number, col: number): TagBinding | undefined {
  return (el.bindings ?? []).find(b => b.cell?.row === row && b.cell?.col === col);
}

/** Свойство таблицы по имени. */
export function propertyByName(
  el: DiagramElement,
  name: string,
): PropertyCreateDto | undefined {
  return (el.properties ?? []).find(p => p.name === name);
}

/** Статическое поле свойства строкой. `value` сюда не попадает — оно живое. */
const staticFieldText = (prop: PropertyCreateDto, field: CellSourceField): string => {
  switch (field) {
    case "name": return prop.name ?? "";
    case "tag_id": return prop.tag_id ?? "";
    case "value_type": return prop.value_type ?? "";
    case "property_type": return prop.property_type ?? "";
    case "default_value": return prop.default_value ?? "";
    case "description": return prop.description ?? "";
    default: return "";
  }
};

/**
 * Текст ячейки для отрисовки.
 *
 * Порядок: привязка на статическое поле → берём из свойства; привязка на `value` →
 * рантайм-оверрайд `cell_R_C`, а до первого кадра — `default_value` свойства; привязки
 * нет → свободный текст из `cells["R_C"]`.
 *
 * `rendered` — элемент после наложения состояния и рантайм-оверрайдов
 * (`getRenderedElementWith`): живое значение лежит в нём ПЛОСКИМ ключом `cell_R_C`,
 * а не внутри `cells`.
 */
export function resolveCellText(
  el: DiagramElement,
  rendered: Record<string, unknown>,
  row: number,
  col: number,
): string {
  const binding = cellBindingAt(el, row, col);
  const cells = rendered.cells as Parameters<typeof getCellData>[0];

  if (!binding?.cell) return getCellData(cells, row, col).value ?? "";

  const prop = propertyByName(el, binding.cell.propertyName);
  // Свойство переименовали или удалили — показываем пусто, а не имя из привязки:
  // иначе таблица врала бы, что данные есть.
  if (!prop) return "";

  if (!isLiveField(binding.cell.field)) return staticFieldText(prop, binding.cell.field);

  const live = rendered[cellRuntimeKey(row, col)];
  if (typeof live === "string" || typeof live === "number") return String(live);
  return prop.default_value ?? "";
}
