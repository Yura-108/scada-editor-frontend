"use client";

import React from "react";
import {cn} from "@/lib/utils";
import {DiagramElement, ElementType, PropertySchema} from "@/types/editorElement.type";
import {elementPropertyMap, basePropertySchema} from "@/constants/propertiesPanel";
import {Plus} from "lucide-react";
import {handleBindTag} from "@/lib/handleBindTag";
import {StateSelect} from "@/components/ui/StateSelect";
import {openInputModal} from "@/components/ui/OpenInputModal";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";

interface PropertiesPanelProps {
  element: DiagramElement | null;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({element}) => {
  const {updateElementVisual, addComponentStateToSubtree, setCurrentComponentStateId} = useEditorStore.getState();
  if (!element) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm italic">
        Выберите элемент для редактирования свойств
      </div>
    );
  }

  const renderedElement = getRenderedElement(element);
  const renderedElementValues = renderedElement as unknown as Record<string, unknown>;
  const elementProperties = element.properties ?? [];

  const schema: PropertySchema[] = [
    ...basePropertySchema,
    ...(elementPropertyMap[element.type as ElementType] || []),
  ];

  const baseInputClasses = cn(
    "w-full bg-neutral-900/80 border border-neutral-700 rounded-lg px-3 py-2 text-sm",
    "text-neutral-100 placeholder:text-neutral-600",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
    "transition-all duration-200 hover:border-neutral-600"
  );

  const baseAddButtonClasses = cn(
    "flex items-center gap-2 py-2",
    "hover:underline hover:scale-105",
    "rounded-xl",
    "text-sm text-gray-200 font-medium",
    "transition-all duration-200",
    "active:scale-95"
  );

  const addComponentState = (value: string) => {
    const createdStateId = addComponentStateToSubtree(element.key, value);
    if (createdStateId) {
      setCurrentComponentStateId(element.key, createdStateId);
    }
  }

  const getNumberValue = (rawValue: unknown, fallback = 0) => {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <div
      className="h-full flex flex-col bg-neutral-950/70 backdrop-blur-sm border-l border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 pb-3 border-b border-neutral-800">
        <h3 className="text-base font-medium text-neutral-200 tracking-tight">
          {element.type.charAt(0).toUpperCase() + element.type.slice(1)} Properties
        </h3>
        <p className="text-xs text-neutral-500 mt-1 font-mono">
          ID: {element.key.slice(0, 8)}...
        </p>
      </div>

      {/* Список свойств */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5 text-sm">
        {schema.map((property, index) => {
          const rawValue = renderedElementValues[property.key];
          const uniqueKey = `${element.id}-${property.key}-${index}`;

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
              className="block text-xs font-medium text-neutral-400 mb-1.5 tracking-tight"
            >
              {property.label}
            </label>
          );

          switch (property.type) {
            case "text":
              return (
                <div key={uniqueKey} className="space-y-1.5">
                  {label}
                  <input
                    id={`prop-${property.key}`}
                    className={baseInputClasses}
                    value={textValue}
                    placeholder={property.placeholder || ""}
                    onChange={(e) =>
                      updateElementVisual(element.key, {[property.key]: e.target.value})
                    }
                  />
                </div>
              );

            case "number":
              return (
                <div key={uniqueKey} className="space-y-1.5">
                  {label}
                  <input
                    id={`prop-${property.key}`}
                    type="number"
                    className={baseInputClasses}
                    value={numberValue}
                    min={property.min}
                    max={property.max}
                    step={property.step ?? 1}
                    onChange={(e) =>
                      updateElementVisual(element.key, {
                        [property.key]: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              );

            case "color":
              return (
                <div key={uniqueKey} className="space-y-1.5">
                  {label}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-md border border-neutral-600 shadow-sm shrink-0 ring-1 ring-neutral-700/50"
                      style={{backgroundColor: colorValue}}
                    />
                    <input
                      id={`prop-${property.key}`}
                      type="color"
                      className={cn(baseInputClasses, "h-9 p-1 cursor-pointer")}
                      value={colorValue}
                      onChange={(e) =>
                        updateElementVisual(element.key, {[property.key]: e.target.value})
                      }
                    />
                  </div>
                </div>
              );

            case "select":
              return (
                <div key={uniqueKey} className="space-y-1.5">
                  {label}
                  <select
                    id={`prop-${property.key}`}
                    className={cn(baseInputClasses, "appearance-none pr-8")}
                    value={selectValue}
                    onChange={(e) =>
                      updateElementVisual(element.key, {[property.key]: e.target.value})
                    }
                  >
                    {property.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );

            case "boolean":
              return (
                <div key={uniqueKey} className="flex items-center gap-2 py-1">
                  <input
                    id={`prop-${property.key}`}
                    type="checkbox"
                    checked={booleanValue}
                    onChange={(e) =>
                      updateElementVisual(element.key, {[property.key]: e.target.checked})
                    }
                    className={cn(
                      "w-4 h-4 rounded border-neutral-600 bg-neutral-800",
                      "text-blue-500 focus:ring-blue-500/40 focus:ring-offset-neutral-950",
                      "checked:bg-blue-600 checked:border-blue-600",
                      "transition-all duration-150"
                    )}
                  />
                  <label
                    htmlFor={`prop-${property.key}`}
                    className="text-sm text-neutral-300 cursor-pointer select-none"
                  >
                    {property.label}
                  </label>
                </div>
              );

            default:
              return null;
          }
        })}

        <div className="h-px bg-linear-to-r from-gray-700 via-gray-500 to-gray-700"/>

        {/* Теги */}

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">
            Привязанные теги
          </h4>

          {elementProperties.length === 0 ? (
            <div className="text-sm text-gray-500 italic py-1">
              Нет привязанных тегов
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {elementProperties.map(property => (
                <span
                  key={property.id}
                  className={`
                    inline-flex items-center px-2.5 py-1 
                    text-xs font-medium rounded-full
                    bg-indigo-950/60 text-indigo-300
                    border border-indigo-800/40
                    hover:bg-indigo-900/70 transition-colors
                  `}
                >
                #{property.tag_id}
              </span>
              ))}
            </div>
          )}

          <button
            className={baseAddButtonClasses}
            onClick={() => handleBindTag(element?.id)}
          >
            <Plus size={18}/>
            Привязать тег
          </button>
        </div>

        <div className="h-px bg-linear-to-r from-gray-700 via-gray-500 to-gray-700"/>

        {/* Состояние */}

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">
            Состояние:
          </h4>

          <StateSelect elementKey={element.key} states={element.states}/>

          <button
            className={baseAddButtonClasses}
            onClick={() => openInputModal({
              title: "Добавление нового состояния",
              description: "Введите название состояния",
              label: "Название состояния",
              placeholder: "Включено, Отключено, Открыто и тд",
              onConfirm: addComponentState
            })}
          >
            <Plus size={18}/>
            Добавить состояние
          </button>
        </div>
      </div>
    </div>
  );
};