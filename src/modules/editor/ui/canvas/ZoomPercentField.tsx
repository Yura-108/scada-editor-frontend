"use client";

import React, {useState} from "react";
import {Input} from "@/shared/ui/field/Input";

/**
 * Текущий масштаб в панели зума. Щелчок — поле, куда вводится точный процент; Enter или уход
 * с поля применяет, Esc — отмена. Кнопки «−»/«+» идут по ряду масштабов, точное значение —
 * здесь (#18 п. 2).
 */
export function ZoomPercentField({zoom, onZoomTo}: {zoom: number; onZoomTo: (zoom: number) => void}) {
  const [draft, setDraft] = useState<string | null>(null);
  const percent = Math.round(zoom * 100);

  const apply = () => {
    const value = Number((draft ?? "").replace(",", ".").replace("%", "").trim());
    setDraft(null);
    if (Number.isFinite(value) && value > 0) onZoomTo(value / 100);
  };

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(String(percent))}
        title="Ввести масштаб"
        className="w-12 rounded text-center text-xs font-medium text-foreground tabular-nums hover:bg-accent"
      >
        {percent}%
      </button>
    );
  }

  return (
    <Input
      size="sm"
      autoFocus
      aria-label="Масштаб, %"
      inputMode="decimal"
      className="h-7 w-14 px-1 text-center text-xs tabular-nums"
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={apply}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); apply(); }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setDraft(null); }
      }}
    />
  );
}
