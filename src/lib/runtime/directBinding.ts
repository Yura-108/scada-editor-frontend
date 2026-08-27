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
