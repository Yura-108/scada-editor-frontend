"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { DiagramElement } from "@/types/editorElement.type";
import { elementPropertyMap, basePropertySchema } from "@/constants/propertiesPanel";

interface PropertiesPanelProps {
  element: DiagramElement | null;           // ← добавил null-check, т.к. часто нет выбранного
  updateElement: (id: string, patch: Partial<DiagramElement>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  element,
  updateElement,
}) => {
  if (!element) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
        Select an element to edit properties
      </div>
    );
  }

  const schema = [
    ...basePropertySchema,
    ...(elementPropertyMap[element.type] || []),
  ];

  return (
    <div className="h-full overflow-y-auto bg-neutral-950/70 backdrop-blur-sm border-l border-neutral-800 p-4 space-y-5 text-sm">
      {/* Header */}
      <div className="pb-3 border-b border-neutral-800">
        <h3 className="text-base font-medium text-neutral-200">
          {element.type.charAt(0).toUpperCase() + element.type.slice(1)} Properties
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">ID: {element.id.slice(0, 8)}...</p>
      </div>

      {/* Properties grid */}
      <div className="space-y-4">
        {schema.map((property) => {
          const value = (element as any)[property.key] ?? property.defaultValue;
          const uniqueKey = `${element.id}-${property.key}`;

          const label = (
            <label
              htmlFor={`prop-${property.key}`}
              className="block text-xs font-medium text-neutral-400 mb-1.5 tracking-tight"
            >
              {property.label}
            </label>
          );

          const baseInputClasses = cn(
            "w-full bg-neutral-900/80 border border-neutral-700 rounded-md px-3 py-1.5 text-sm",
            "text-neutral-100 placeholder:text-neutral-600",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
            "transition-all duration-150"
          );

          switch (property.type) {
            case "text":
              return (
                <div key={uniqueKey} className="space-y-1.5">
                  {label}
                  <input
                    id={`prop-${property.key}`}
                    className={baseInputClasses}
                    value={value ?? ""}
                    placeholder={property.placeholder || ""}
                    onChange={(e) =>
                      updateElement(element.id, { [property.key]: e.target.value })
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
                    value={value ?? 0}
                    min={property.min}
                    max={property.max}
                    step={property.step ?? 1}
                    onChange={(e) =>
                      updateElement(element.id, {
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
                      className="w-8 h-8 rounded-md border border-neutral-600 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: value ?? "#ffffff" }}
                    />
                    <input
                      id={`prop-${property.key}`}
                      type="color"
                      className={cn(
                        baseInputClasses,
                        "h-9 p-1 cursor-pointer"
                      )}
                      value={element.bg?.startsWith("#") ? element.bg : "#ffffff"}
                      onChange={(e) =>
                        updateElement(element.id, { [property.key]: e.target.value })
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
                    value={value ?? ""}
                    onChange={(e) =>
                      updateElement(element.id, { [property.key]: e.target.value })
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
                    checked={!!value}
                    onChange={(e) =>
                      updateElement(element.id, { [property.key]: e.target.checked })
                    }
                    className={cn(
                      "w-4 h-4 rounded border-neutral-600 bg-neutral-800",
                      "text-blue-500 focus:ring-blue-500/40",
                      "checked:bg-blue-600 checked:border-blue-600",
                      "transition-colors"
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
      </div>
    </div>
  );
};