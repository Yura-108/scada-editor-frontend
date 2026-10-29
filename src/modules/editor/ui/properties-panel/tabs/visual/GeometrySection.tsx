"use client";

import {NumberInput} from "@/shared/ui/field/NumberInput";
import {useEditorStore} from "../../../../model/editorStore";
import {getGeometryFields} from "../../lib/geometryFields";
import {getNumberValue} from "../../lib/getNumberValue";
import {baseInputClasses} from "../../panelClasses";
import {historyEditing} from "../../../../model/historyGroup";

interface GeometrySectionProps {
  elementKey: string;
  type: string;
  /** Отображаемый вид элемента (`getRenderedElement`). */
  values: Record<string, unknown>;
}

/**
 * Геометрия: точное позиционирование (координаты локальны родителю).
 * У линии позиция кодируется концами x1/y1/x2/y2, а не x/y/w/h.
 */
export function GeometrySection({elementKey, type, values}: GeometrySectionProps) {
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);
  const geometryFields = getGeometryFields(type, values);

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-2 uppercase tracking-wider">
        Геометрия
      </h4>
      <div className="grid grid-cols-2 gap-4">
        {geometryFields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label
              htmlFor={`geom-${field.key}`}
              className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
            >
              {field.label}
            </label>
            <NumberInput {...historyEditing}
              id={`geom-${field.key}`}
              className={baseInputClasses}
              value={field.value ?? getNumberValue(values[field.key])}
              step={1}
              onCommit={(v) =>
                updateElementVisual(elementKey, field.commit ? field.commit(v) : {[field.key]: v})
              }
            />
          </div>
        ))}
      </div>
      <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700 mt-5" />
    </div>
  );
}
