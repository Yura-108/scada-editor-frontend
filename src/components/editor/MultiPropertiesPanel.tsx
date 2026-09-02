"use client";

import React, {useMemo} from "react";
import {cn} from "@/lib/utils";
import {DiagramElement, ElementType, PropertySchema} from "@/types/editorElement.type";
import {elementPropertyMap, Z_INDEX_FIELD} from "@/constants/propertiesPanel";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {ColorField} from "@/components/ui/ColorField";
import {NumberInput} from "@/components/ui/NumberInput";

interface MultiPropertiesPanelProps {
  elements: DiagramElement[];
}

/**
 * Панель для мульти-выделения: редактирует общие свойства сразу у всех выбранных.
 * Показываются только параметры, которые есть у КАЖДОГО выбранного типа
 * (пересечение схем по key+type) + общая геометрия (Ш/В). Разные значения
 * показываются как «—»/пусто; ввод применяет значение ко всем (один шаг undo).
 */
export function MultiPropertiesPanel({elements}: MultiPropertiesPanelProps) {
  const updateElementsVisual = useEditorStore(s => s.updateElementsVisual);

  const keys = useMemo(() => elements.map(el => el.key), [elements]);
  const renderedAll = useMemo(() => elements.map(el => getRenderedElement(el) as unknown as Record<string, unknown>), [elements]);

  // Пересечение схем свойств всех выбранных типов (совпадение по key и type поля).
  const commonSchema: PropertySchema[] = useMemo(() => {
    const types = [...new Set(elements.map(el => el.type))];
    if (!types.length) return [];
    const base = elementPropertyMap[types[0] as ElementType] ?? [];
    return [
      // Слой есть у любого элемента (BaseCanvasElement.zIndex), в elementPropertyMap
      // его нет — там схемы по типам. Задавать слой сразу нескольким полезно.
      Z_INDEX_FIELD,
      ...base.filter(prop =>
        types.every(t => (elementPropertyMap[t as ElementType] ?? []).some(p => p.key === prop.key && p.type === prop.type)),
      ),
    ];
  }, [elements]);

  // Общее значение поля по всем выбранным (undefined — значения различаются).
  const sharedValue = (key: string): unknown => {
    const first = renderedAll[0]?.[key];
    return renderedAll.every(r => r[key] === first) ? first : undefined;
  };

  const apply = (key: string, value: unknown) => updateElementsVisual(keys, {[key]: value});

  const baseInputClasses = cn(
    "w-full bg-white/80 dark:bg-neutral-900/80 border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm",
    "text-gray-900 dark:text-neutral-100 placeholder:text-gray-500 dark:placeholder:text-neutral-600",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
    "transition-all duration-200 hover:border-gray-400 dark:hover:border-neutral-600",
  );

  const label = (text: string, htmlFor: string) => (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight">
      {text}
    </label>
  );

  const renderInput = (prop: PropertySchema) => {
    const shared = sharedValue(prop.key);
    const id = `multi-${prop.key}`;

    switch (prop.type) {
      case "number":
        return (
          <div key={prop.key} className="space-y-1.5">
            {label(prop.label, id)}
            <NumberInput
              id={id} className={baseInputClasses}
              value={typeof shared === "number" ? shared : undefined}
              placeholder={shared === undefined ? "разные" : ""}
              onCommit={(v) => apply(prop.key, v)}
            />
          </div>
        );
      case "text":
        return (
          <div key={prop.key} className="space-y-1.5">
            {label(prop.label, id)}
            <input
              id={id} className={baseInputClasses}
              value={typeof shared === "string" ? shared : ""}
              placeholder={shared === undefined ? "разные" : ""}
              onChange={(e) => apply(prop.key, e.target.value)}
            />
          </div>
        );
      case "color":
        return (
          <ColorField
            key={prop.key}
            id={id}
            label={prop.label}
            value={typeof shared === "string" && shared ? shared : undefined}
            onChange={(v) => apply(prop.key, v)}
            inputClassName={baseInputClasses}
          />
        );
      case "select":
        return (
          <div key={prop.key} className="space-y-1.5">
            {label(prop.label, id)}
            <select
              id={id} className={cn(baseInputClasses, "appearance-none pr-8")}
              value={typeof shared === "string" ? shared : ""}
              onChange={(e) => apply(prop.key, e.target.value)}
            >
              {shared === undefined && <option value="" disabled>— разные —</option>}
              {prop.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        );
      case "boolean":
        return (
          <div key={prop.key} className="flex items-center gap-2 py-1">
            <input
              id={id} type="checkbox"
              checked={shared === true}
              ref={(node) => { if (node) node.indeterminate = shared === undefined; }}
              onChange={(e) => apply(prop.key, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-blue-500"
            />
            <label htmlFor={id} className="text-sm text-gray-800 dark:text-neutral-300 cursor-pointer select-none">
              {prop.label}
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  const sharedW = sharedValue("w");
  const sharedH = sharedValue("h");

  return (
    <div className="h-full flex flex-col bg-white/70 dark:bg-neutral-950/70 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-800 overflow-hidden">
      <div className="shrink-0 p-4 pb-3 border-b border-gray-200 dark:border-neutral-800">
        <h3 className="text-base font-medium text-gray-900 dark:text-neutral-200 tracking-tight">
          Выбрано элементов: {elements.length}
        </h3>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
          Изменения применяются ко всем выбранным
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5 text-sm">
        {/* Общая геометрия: размер (позицию массово не задаём — элементы наложатся друг на друга) */}
        <div>
          <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-2 uppercase tracking-wider">
            Размер
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              {label("Ширина", "multi-w")}
              <NumberInput
                id="multi-w" className={baseInputClasses}
                value={typeof sharedW === "number" ? sharedW : undefined}
                placeholder={sharedW === undefined ? "разные" : ""}
                onCommit={(v) => apply("w", v)}
              />
            </div>
            <div className="space-y-1.5">
              {label("Высота", "multi-h")}
              <NumberInput
                id="multi-h" className={baseInputClasses}
                value={typeof sharedH === "number" ? sharedH : undefined}
                placeholder={sharedH === undefined ? "разные" : ""}
                onCommit={(v) => apply("h", v)}
              />
            </div>
          </div>
        </div>

        {commonSchema.length > 0 && (
          <div className="space-y-4">
            <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700" />
            <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
              Общие параметры
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {commonSchema.filter(p => p.type !== "color").map(renderInput)}
            </div>
            <div className="space-y-4">
              {commonSchema.filter(p => p.type === "color").map(renderInput)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
