"use client";

import React, {useState} from "react";
import {Ban} from "lucide-react";
import {cn} from "@/lib/utils";

interface ColorFieldProps {
  id: string;
  label: string;
  /** Текущее значение ("#rrggbb" | "transparent" | undefined — значения различаются). */
  value: string | undefined;
  onChange: (value: string) => void;
  inputClassName: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Шахматка для индикации прозрачного цвета. */
const CHECKER = "repeating-conic-gradient(#c9c9c9 0% 25%, #ffffff 0% 50%) 50% / 12px 12px";

/**
 * Поле цвета: пикер + hex-ввод + кнопка «прозрачный».
 * Hex принимает #rgb/#rrggbb (решётку можно не печатать) и слово transparent.
 */
export function ColorField({id, label, value, onChange, inputClassName}: ColorFieldProps) {
  // Черновик hex-ввода: пока пользователь печатает невалидное значение, не сбрасываем ввод.
  const [draft, setDraft] = useState<string | null>(null);

  const isTransparent = value === "transparent";
  const pickerValue = value && HEX_RE.test(value) && value.length === 7 ? value : "#ffffff";
  const shownText = draft ?? (value ?? "");

  const tryCommit = (raw: string): boolean => {
    const t = raw.trim().toLowerCase();
    if (t === "transparent") {
      onChange("transparent");
      return true;
    }
    const hex = t.startsWith("#") ? t : `#${t}`;
    if (HEX_RE.test(hex)) {
      onChange(hex);
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
      >
        {label}{value === undefined ? " (разные)" : ""}
      </label>
      <div className="flex items-center gap-2">
        {/* Свотч: шахматка для transparent */}
        <div
          className="w-8 h-8 rounded-md border border-gray-300 dark:border-neutral-600 shadow-sm shrink-0 ring-1 ring-neutral-700/50"
          style={{background: isTransparent || !value ? CHECKER : value}}
          title={value ?? "разные"}
        />
        <input
          id={id}
          type="color"
          className={cn(inputClassName, "h-9 w-12 p-1 cursor-pointer shrink-0")}
          value={pickerValue}
          onChange={(e) => { setDraft(null); onChange(e.target.value); }}
        />
        <input
          type="text"
          className={cn(inputClassName, "font-mono text-xs")}
          value={shownText}
          placeholder={value === undefined ? "разные" : "#rrggbb"}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            if (tryCommit(e.target.value)) setDraft(null);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              tryCommit((e.target as HTMLInputElement).value);
              setDraft(null);
            }
          }}
        />
        <button
          type="button"
          title="Прозрачный"
          onClick={() => { setDraft(null); onChange(isTransparent ? pickerValue : "transparent"); }}
          className={cn(
            "shrink-0 p-2 rounded-lg border transition-colors",
            isTransparent
              ? "border-blue-500/60 bg-blue-500/15 text-blue-500"
              : "border-gray-300 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-400 dark:hover:border-neutral-500",
          )}
        >
          <Ban size={14} />
        </button>
      </div>
    </div>
  );
}
