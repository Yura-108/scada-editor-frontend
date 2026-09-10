import {createUuid} from "@/lib/createUuid";
import {uniqueVarName} from "@/lib/runtime/bindingScope";
import type {TagBinding} from "@/types/binding.types";
import type {PickedProperty} from "@/components/editor/bindings/OpenChooseObjectPropertyModal";

/**
 * Строит прямую привязку «target ← свойство»: `setProp(target, var)`, без кода/имени
 * в UI. `target` — любой ключ рендер-пропа элемента: `"value"` (весь элемент, см.
 * BindingsTab) или `"cell_${row}_${col}"` (конкретная ячейка таблицы, см. tableCells.ts).
 */
export function buildDirectBinding(
  target: string,
  picked: PickedProperty,
  takenVarNames: ReadonlySet<string>,
): TagBinding {
  const varName = uniqueVarName(picked.propertyName, takenVarNames);
  return {
    v: 1,
    id: createUuid(),
    name: picked.propertyName,
    enabled: true,
    direct: true,
    directTarget: target,
    code: `setProp(${JSON.stringify(target)}, ${varName})`,
    propertyRefs: [
      {
        varName,
        propertyId: picked.propertyId,
        componentKey: picked.componentKey,
        componentId: picked.componentId,
        componentLabel: picked.componentLabel,
        propertyName: picked.propertyName,
        valueType: picked.valueType,
      },
    ],
  };
}

/**
 * Прямая привязка «target ← ТЕГ»: значение пишется рантаймом напрямую по `tag_id`.
 *
 * `code` пуст намеренно — это не JS-биндинг: значение маршрутизируется по тегу так же,
 * как живые значения ячеек таблиц (см. bindingIndex.ts). Поэтому элементу не нужно ни
 * собственных свойств, ни скоупа: одной такой привязки достаточно, чтобы прогресс-бар
 * следовал за тегом.
 */
export function buildDirectTagBinding(target: string, tagId: string): TagBinding {
  return {
    v: 1,
    id: createUuid(),
    // Имя показывается в списке привязок; путь тега — самое понятное, что тут можно дать.
    name: tagId,
    enabled: true,
    direct: true,
    directTarget: target,
    tag: tagId,
    code: "",
    // Триггер один и он же источник: без этого прогон при смене схемы не считал бы
    // значение известным (см. hasKnownTrigger).
    triggers: [tagId],
  };
}
