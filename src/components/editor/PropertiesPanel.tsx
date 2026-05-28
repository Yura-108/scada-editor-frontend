"use client";

import React, {useState, useMemo} from "react";
import {cn} from "@/lib/utils";
import {DiagramElement, ElementType, PropertySchema} from "@/types/editorElement.type";
import {elementPropertyMap, basePropertySchema} from "@/constants/propertiesPanel";
import {Plus} from "lucide-react";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {StateSelect} from "@/components/ui/StateSelect";
import {openInputModal} from "@/components/ui/OpenInputModal";
import {openScriptEditorModal} from "@/components/ui/OpenScriptEditorModal";
import {useEditorStore} from "@/store/useEditorStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {createUuid} from "@/lib/createUuid";

interface PropertiesPanelProps {
  element: DiagramElement | null;
}

type TabType = "visual" | "states" | "properties" | "scripts";

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({element}) => {
  const [activeTab, setActiveTab] = useState<TabType>("visual");
  const {
    updateElement,
    updateElementVisual,
    addComponentStateToSubtree,
    setCurrentComponentStateId,
    currentComponentStateByElementKey
  } = useEditorStore();

  const currentComponentStateId = element
    ? (currentComponentStateByElementKey[element.key] ?? element.states.find(s => s.isDefault)?.id ?? element.states[0]?.id)
    : undefined;

  const renderedElement = useMemo(() => element ? getRenderedElement(element) : null, [element, currentComponentStateId]);
  const renderedElementValues = useMemo(
    () => renderedElement ? (renderedElement as unknown as Record<string, unknown>) : {},
    [renderedElement]
  );
  const elementProperties = useMemo(() => element?.properties ?? [], [element?.properties]);
  const elementScripts = useMemo(() => element?.scripts ?? [], [element?.scripts]);

  const schema: PropertySchema[] = useMemo(() => element ? [
    ...basePropertySchema,
    ...(elementPropertyMap[element.type as ElementType] || []),
  ] : [], [element?.type, element]);

  if (!element) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
        Выберите элемент для редактирования свойств
      </div>
    );
  }

  const baseInputClasses = cn(
    "w-full bg-white/80 dark:bg-neutral-900/80 border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm",
    "text-gray-900 dark:text-neutral-100 placeholder:text-gray-500 dark:placeholder:text-neutral-600",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
    "transition-all duration-200 hover:border-gray-400 dark:hover:border-neutral-600"
  );

  const baseAddButtonClasses = cn(
    "flex items-center gap-2 py-2",
    "hover:underline hover:scale-105",
    "rounded-xl",
    "text-sm font-medium",
    "text-gray-800 dark:text-gray-200",
    "transition-all duration-200",
    "active:scale-95"
  );

  const tabButtonClasses = (isActive: boolean) => cn(
    "flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200",
    "border border-gray-300 dark:border-neutral-700",
    isActive
      ? "bg-blue-600/40 text-blue-200 border-blue-500/50 dark:bg-blue-600/70 dark:text-blue-100 dark:border-blue-500/70"
      : "bg-gray-100/40 text-gray-600 hover:bg-gray-200/60 hover:text-gray-500 dark:bg-neutral-900/40 dark:text-neutral-400 hover:dark:bg-neutral-800/60 hover:dark:text-neutral-300"
  );

  const addComponentState = (value: string) => {
    const createdStateId = addComponentStateToSubtree(element.key, value);
    if (createdStateId) {
      setCurrentComponentStateId(element.key, createdStateId);
    }
  }

  const handleAddScript = () => {
    if (!element) return;
    openScriptEditorModal({
      title: "Добавление скрипта",
      description: "Напишите Java-код для обработки событий компонента",
      onConfirm: (name, content) => {
        const newScript = { id: createUuid(), name, content };
        updateElement(element.key, {
          scripts: [...(element.scripts || []), newScript]
        });
      }
    });
  }

  const getNumberValue = (rawValue: unknown, fallback = 0) => {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const renderPropertyInput = (property: PropertySchema, index: number) => {
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
        className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
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
                className="w-8 h-8 rounded-md border border-gray-300 dark:border-neutral-600 shadow-sm shrink-0 ring-1 ring-neutral-700/50"
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
                "w-4 h-4 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800",
                "text-blue-500 focus:ring-blue-500/40 focus:ring-offset-white dark:focus:ring-offset-neutral-950",
                "checked:bg-blue-600 checked:border-blue-600",
                "transition-all duration-150"
              )}
            />
            <label
              htmlFor={`prop-${property.key}`}
              className="text-sm text-gray-800 dark:text-neutral-300 cursor-pointer select-none"
            >
              {property.label}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div key={element.key} className="h-full flex flex-col bg-white/70 dark:bg-neutral-950/70 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 pb-3 border-b border-gray-200 dark:border-neutral-800">
        <h3 className="text-base font-medium text-gray-900 dark:text-neutral-200 tracking-tight">
          {element.type.charAt(0).toUpperCase() + element.type.slice(1)} Properties
        </h3>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 font-mono">
          ID: {element.key.slice(0, 8)}...
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-neutral-800">
        <div className="grid grid-rows-2 grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab("visual")}
            className={tabButtonClasses(activeTab === "visual")}
          >
            Визуал
          </button>
          <button
            onClick={() => setActiveTab("states")}
            className={tabButtonClasses(activeTab === "states")}
          >
            Состояния
          </button>
          <button
            onClick={() => setActiveTab("properties")}
            className={tabButtonClasses(activeTab === "properties")}
          >
            Свойства
          </button>
          <button
            onClick={() => setActiveTab("scripts")}
            className={tabButtonClasses(activeTab === "scripts")}
          >
            Скрипты
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5 text-sm">

        {/* Визуальные параметры */}
        {activeTab === "visual" && (
          <div className="space-y-5">
            {/* Обычные параметры - два в ряд */}
            <div className="grid grid-cols-2 gap-4">
              {schema
                .filter(property => property.type !== "color")
                .map((property, index) => (
                  <div key={`${element.id}-${property.key}-${index}`}>
                    {renderPropertyInput(property, index)}
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
                    .map((property, index) => renderPropertyInput(property, index))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Состояния */}
        {activeTab === "states" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">
                Состояние:
              </h4>
              <StateSelect elementKey={element.key} states={element.states}/>
            </div>

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
        )}

        {/* Свойства */}
        {activeTab === "properties" && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">
              Добавленные свойства
            </h4>

            {elementProperties.length === 0 ? (
              <div className="text-sm text-gray-500 italic py-3">
                Нет добавленных свойств
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {elementProperties.map(property => (
                  <span
                    key={property.id}
                    onClick={() => handleAddProperty(element?.id, property)}
                    className={`
                      inline-flex items-center px-2.5 py-1.5
                      text-xs font-medium rounded-full
                      bg-indigo-950/60 text-indigo-300
                      border border-indigo-800/40
                      hover:bg-indigo-900/70 transition-colors cursor-pointer
                    `}
                  >
                    {property.name || property.property_type || "Свойство"}
                    {property.tag_id ? ` • #${property.tag_id}` : ""}
                  </span>
                ))}
              </div>
            )}

            <button
              className={baseAddButtonClasses}
              onClick={() => handleAddProperty(element?.id)}
            >
              <Plus size={18}/>
              Добавить свойство
            </button>
          </div>
        )}

        {/* Скрипты */}
        {activeTab === "scripts" && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">
              Добавленные скрипты
            </h4>

            {elementScripts.length === 0 ? (
              <div className="text-sm text-gray-500 italic py-3">
                Нет добавленных скриптов
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {elementScripts.map(script => (
                  <span
                    key={script.id}
                    className={`
                      inline-flex items-center px-2.5 py-1.5
                      text-xs font-medium rounded-full
                      bg-blue-950/60 text-blue-300
                      border border-blue-800/40
                      hover:bg-blue-900/70 transition-colors cursor-pointer
                    `}
                    onClick={() => {
                        openScriptEditorModal({
                          title: "Редактирование скрипта",
                          description: "Отредактируйте JS-код скрипта",
                          defaultName: script.name,
                          defaultContent: script.content,
                          onConfirm: (name, content) => {
                            const updatedScripts = elementScripts.map(s =>
                              s.id === script.id ? { ...s, name, content } : s
                            );
                            updateElement(element.key, { scripts: updatedScripts });
                          }
                        });
                    }}
                  >
                    {script.name}
                  </span>
                ))}
              </div>
            )}

            <button
              className={baseAddButtonClasses}
              onClick={handleAddScript}
            >
              <Plus size={18}/>
              Добавить скрипт
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
