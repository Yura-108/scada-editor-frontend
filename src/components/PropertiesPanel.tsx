"use client";

import { useEditorStore } from "@/store/useEditorStore";
import React from "react";
import { cn } from "@/lib/utils";

export default function PropertiesPanel() {
  const { elements, selectedId, updateElement } = useEditorStore();

  const el = elements
    .filter((el) => el.type !== "connection")
    .find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div className="w-full bg-neutral-900/95 border-l border-neutral-800 p-5 flex items-center justify-center text-neutral-500 text-sm">
        <p>Ничего не выбрано</p>
      </div>
    );
  }

  const handleChange =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        key === "label" || key === "bg"
          ? e.target.value
          : Number(e.target.value) || 0;

      updateElement(el.id, { [key]: value });
    };

  return (
    <div className="w-72 bg-neutral-900/95 border-l border-neutral-800 p-5 flex flex-col gap-5 overflow-y-auto">
      <div className="pb-3 border-b border-neutral-800">
        <h3 className="text-lg font-semibold text-neutral-200 tracking-tight">
          Свойства
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          ID: {el.id.slice(0, 8)}...
        </p>
      </div>

      {/* Position */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              X
            </label>
            <input
              type="number"
              value={el.x}
              onChange={handleChange("x")}
              className={cn(
                "w-full bg-neutral-800/70 border border-neutral-700 rounded-md",
                "px-3 py-2 text-sm text-neutral-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
                "transition-all"
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Y
            </label>
            <input
              type="number"
              value={el.y}
              onChange={handleChange("y")}
              className={cn(
                "w-full bg-neutral-800/70 border border-neutral-700 rounded-md",
                "px-3 py-2 text-sm text-neutral-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
                "transition-all"
              )}
            />
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Ширина
            </label>
            <input
              type="number"
              value={el.w}
              onChange={handleChange("w")}
              className={cn(
                "w-full bg-neutral-800/70 border border-neutral-700 rounded-md",
                "px-3 py-2 text-sm text-neutral-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
                "transition-all"
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Высота
            </label>
            <input
              type="number"
              value={el.h}
              onChange={handleChange("h")}
              className={cn(
                "w-full bg-neutral-800/70 border border-neutral-700 rounded-md",
                "px-3 py-2 text-sm text-neutral-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
                "transition-all"
              )}
            />
          </div>
        </div>
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">
          Надпись / Текст
        </label>
        <input
          value={el.label ?? ""}
          onChange={handleChange("label")}
          placeholder="Введите текст..."
          className={cn(
            "w-full bg-neutral-800/70 border border-neutral-700 rounded-md",
            "px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
            "transition-all"
          )}
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1.5">
          Цвет фона
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={el.bg ?? "#ffffff"}
            onChange={handleChange("bg")}
            className={cn(
              "w-10 h-10 rounded-md overflow-hidden cursor-pointer",
              "border border-neutral-600",
              "bg-neutral-800"
            )}
          />
          <code className="text-xs text-neutral-400 font-mono bg-neutral-800/50 px-2.5 py-1.5 rounded border border-neutral-700">
            {el.bg ?? "#ffffff"}
          </code>
        </div>
      </div>
    </div>
  );
}