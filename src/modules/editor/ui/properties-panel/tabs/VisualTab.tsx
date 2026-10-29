"use client";

import {useMemo} from "react";
import {cn} from "@/shared/lib/cn";
import {DiagramElement, ElementType, PropertySchema} from "@/types/editorElement.type";
import {basePropertySchema, elementPropertyMap} from "@/constants/propertiesPanel";
import {StateSelect} from "@/components/ui/StateSelect";
import {useEditorStore} from "../../../model/editorStore";
import {EditAllStatesToggle} from "../EditAllStatesToggle";
import {PropertyInput} from "../PropertyInput";
import {useTableCell} from "../hooks/useTableCell";
import {GeometrySection} from "./visual/GeometrySection";
import {TableCellSection} from "./visual/TableCellSection";
import {TableSizeSection} from "./visual/TableSizeSection";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";

interface VisualTabProps {
  element: DiagramElement;
  /** Отображаемый вид элемента (`getRenderedElement`). */
  values: Record<string, unknown>;
}

/** Вкладка «Визуал»: состояние, ячейка и размеры таблицы, геометрия, свойства типа. */
export function VisualTab({element, values}: VisualTabProps) {
  const editAllStates = useEditorStore(s => s.editAllStates);
  const cell = useTableCell(element, values);

  const schema: PropertySchema[] = useMemo(() => [
    ...basePropertySchema,
    ...(elementPropertyMap[element.type as ElementType] || []),
  ], [element.type]);

  return (
    <div className="space-y-5">
      {/* Текущее состояние — прямо здесь, а не только на вкладке «Состояния».
          Значения ниже относятся ИМЕННО к нему (у листьев они лежат в
          states[].overrides), и без этой строки было неочевидно, чей визуал
          правится: переключил состояние на другой вкладке — и те же поля
          показывают уже другие числа. */}
      <div className="space-y-1.5">
        <label className={fieldLabelSmClass}>
          Состояние
        </label>
        <StateSelect elementKey={element.key} states={element.states}/>
        {element.states.length > 1 && (
          <p className={cn(
            "text-[11px]",
            editAllStates
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-500 dark:text-neutral-500",
          )}>
            {editAllStates
              ? "Значения ниже пишутся во ВСЕ состояния элемента."
              : "Значения ниже относятся к этому состоянию."}
          </p>
        )}
        {/* У элемента с единственным состоянием переключать нечего. Подпись под
            ним не дублируем — строка выше уже сказала, куда лягут значения. */}
        {element.states.length > 1 && <EditAllStatesToggle withHint={false}/>}
      </div>

      <TableCellSection element={element} values={values} cell={cell}/>

      {cell.tableTracks && <TableSizeSection elementKey={element.key} tableTracks={cell.tableTracks}/>}

      <GeometrySection elementKey={element.key} type={element.type} values={values}/>

      {/* Обычные параметры - два в ряд */}
      <div className="grid grid-cols-2 gap-4">
        {schema
          .filter(property => property.type !== "color")
          .map((property, index) => (
            <div key={`${element.id}-${property.key}-${index}`}>
              <PropertyInput elementKey={element.key} property={property} values={values}/>
            </div>
          ))}
      </div>

      {/* Цветовые параметры - полная ширина */}
      {schema.some(p => p.type === "color") && (
        <div className="space-y-4 pt-2">
          <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700" />
          <div className="space-y-4">
            {schema
              .filter(property => property.type === "color")
              .map((property, index) => (
                <PropertyInput
                  key={`${element.id}-${property.key}-${index}`}
                  elementKey={element.key}
                  property={property}
                  values={values}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
