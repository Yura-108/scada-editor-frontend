"use client";

import {useEditorStore} from "@/store/useEditorStore";
import React from "react";

export default function PropertiesPanel() {
  const {elements, selectedId, updateElement} = useEditorStore();

  const el = elements.find(e => e.id === selectedId);

  if (!el) {
    return (
      <div className="w-64 p-3 border-l">
        <p className="text-gray-400">No selection</p>
      </div>
    );
  }

  const change =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>)=> {
    const value = key === "label" || key === "bg"
      ? e.target.value
      : Number(e.target.value);

    updateElement(el?.id, {[key]: value})
  };

  return (
    <div className="w-64 p-3 border-l flex flex-col gap-2">
      <h3 className="font-bold">Properties</h3>
      <label>
        X
        <input
          type="number"
          value={el.x}
          onChange={change("x")}
          className="border w-full"
        />
      </label>

      <label>
        Y
        <input
          type="number"
          value={el.y}
          onChange={change("y")}
          className="border w-full"
        />
      </label>

      <label>
        Width
        <input
          type="number"
          value={el.w}
          onChange={change("w")}
          className="border w-full"
        />
      </label>

      <label>
        Height
        <input
          type="number"
          value={el.h}
          onChange={change("h")}
          className="border w-full"
        />
      </label>

      <label>
        Label
        <input
          value={el.label}
          onChange={change("label")}
          className="border w-full"
        />
      </label>

      <label>
        Color
        <input
          type="color"
          value={el.bg}
          onChange={change("bg")}
          className="w-full h-10"
        />
      </label>
    </div>
  )
}