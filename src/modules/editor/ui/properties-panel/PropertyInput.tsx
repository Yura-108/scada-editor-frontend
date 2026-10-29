"use client";

import {cn} from "@/shared/lib/cn";
import {PropertySchema} from "@/types/editorElement.type";
import {ColorField} from "@/shared/ui/field/ColorField";
import {NumberInput} from "@/shared/ui/field/NumberInput";
import {TextInput} from "@/shared/ui/field/TextInput";
import {useEditorStore} from "../../model/editorStore";
import {getNumberValue} from "./lib/getNumberValue";
import {baseInputClasses} from "./panelClasses";
import {historyEditing} from "../../model/historyGroup";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Select} from "@/shared/ui/field/Select";

interface PropertyInputProps {
  elementKey: string;
  property: PropertySchema;
  /** Отображаемый вид элемента (`getRenderedElement`). */
  values: Record<string, unknown>;
}

/** Поле одного визуального свойства из схемы типа элемента. */
export function PropertyInput({elementKey, property, values}: PropertyInputProps) {
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);

  const handleSelectChange = (key: string, value: string) => {
    // Смена ориентации прогресс-бара меняет местами w/h, чтобы вертикальный бар был
    // реально узким и высоким, а не оставался в приплюснутой коробке (ключ orientation
    // есть только у прогресс-бара). w/h — позиционные поля, рамки групп пересчитаются.
    if (key === "orientation" && value !== values.orientation) {
      const curW = Number(values.w) || 0;
      const curH = Number(values.h) || 0;
      updateElementVisual(elementKey, { orientation: value as "horizontal" | "vertical", w: curH, h: curW });
      return;
    }
    updateElementVisual(elementKey, { [key]: value });
  };

  const rawValue = values[property.key];

  const textValue = typeof rawValue === "string"
    ? rawValue
    : (typeof property.defaultValue === "string" ? property.defaultValue : "");

  const numberValue = getNumberValue(
    rawValue,
    typeof property.defaultValue === "number" ? property.defaultValue : 0
  );

  const colorValue = typeof rawValue === "string" && rawValue
    ? rawValue
    : (typeof property.defaultValue === "string" && property.defaultValue
      ? property.defaultValue
      : "#ffffff");

  const selectValue = typeof rawValue === "string"
    ? rawValue
    : (typeof property.defaultValue === "string" ? property.defaultValue : "");

  const booleanValue = typeof rawValue === "boolean"
    ? rawValue
    : Boolean(property.defaultValue);

  const label = (
    <label
      htmlFor={`prop-${property.key}`}
      className={cn(fieldLabelSmClass, "mb-1.5")}
    >
      {property.label}
    </label>
  );

  switch (property.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          {label}
          {/* Коммит по blur/Enter, а не на каждый символ: иначе каждое нажатие
              клавиши — новый массив elements, то есть шаг undo на символ и
              полный пересчёт схемы с перерисовкой холста. */}
          <TextInput {...historyEditing}
            id={`prop-${property.key}`}
            className={baseInputClasses}
            value={textValue}
            placeholder={property.placeholder || ""}
            onCommit={(v) => updateElementVisual(elementKey, {[property.key]: v})}
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          {label}
          <NumberInput {...historyEditing}
            id={`prop-${property.key}`}
            className={baseInputClasses}
            value={numberValue}
            min={property.min}
            max={property.max}
            step={property.step ?? 1}
            onCommit={(v) => updateElementVisual(elementKey, {[property.key]: v})}
          />
        </div>
      );

    case "color":
      return (
        <ColorField {...historyEditing}
         
          id={`prop-${property.key}`}
          label={property.label}
          value={colorValue}
          onChange={(v) => updateElementVisual(elementKey, {[property.key]: v})}
          inputClassName={baseInputClasses}
        />
      );

    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select
            id={`prop-${property.key}`}
            size="sm"
            value={selectValue}
            onValueChange={(v) => handleSelectChange(property.key, v)}
            options={property.options ?? []}
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2 py-1">
          <Checkbox
            checked={booleanValue}
            onChange={(e) =>
              updateElementVisual(elementKey, {[property.key]: e.target.checked})
            }
            label={property.label}
          />
        </div>
      );

    default:
      return null;
  }
}
