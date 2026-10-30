"use client";

import React, {useEffect, useRef, useState} from "react";
import {Ban} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {cn} from "@/shared/lib/cn";
import type {EditSession} from "./editSession";
import {fieldBase, fieldLabelSmClass, fieldSizes} from "./fieldStyles";

interface ColorFieldProps extends EditSession {
  id: string;
  label: string;
  /** Текущее значение ("#rrggbb" | "transparent" | undefined — значения различаются). */
  value: string | undefined;
  onChange: (value: string) => void;
  /** Дополнительные классы обоих полей (пикера и hex). */
  inputClassName?: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Шахматка для индикации прозрачного цвета. */
const CHECKER = "repeating-conic-gradient(#c9c9c9 0% 25%, #ffffff 0% 50%) 50% / 12px 12px";

/**
 * Поле цвета: пикер + hex-ввод + кнопка «прозрачный».
 * Hex принимает #rgb/#rrggbb (решётку можно не печатать) и слово transparent.
 */
export function ColorField({id, label, value, onChange, inputClassName, onEditStart, onEditEnd}: ColorFieldProps) {
  // Черновик hex-ввода: пока пользователь печатает невалидное значение, не сбрасываем ввод.
  const [draft, setDraft] = useState<string | null>(null);

  // Ведение по палитре шлёт onChange непрерывно — это десятки правок в секунду,
  // каждая из которых была отдельным шагом undo. Всё ведение до потери фокуса
  // склеиваем в один шаг.
  const groupingRef = useRef(false);
  const beginGrouping = () => {
    if (groupingRef.current) return;
    groupingRef.current = true;
    onEditStart?.();
  };
  const endGrouping = () => {
    if (!groupingRef.current) return;
    groupingRef.current = false;
    onEditEnd?.();
  };
  // Страховка: элемент могли снять с выделения прямо во время ведения —
  // без этого история осталась бы на паузе навсегда.
  useEffect(() => endGrouping, []);

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
      <label htmlFor={id} className={cn(fieldLabelSmClass, "mb-1.5")}>
        {label}{value === undefined ? " (разные)" : ""}
      </label>
      <div className="flex items-center gap-2">
        {/* Свотч: шахматка для transparent */}
        <div
          className="w-8 h-8 rounded-md border border-input shrink-0"
          style={{background: isTransparent || !value ? CHECKER : value}}
          title={value ?? "разные"}
        />
        <input
          id={id}
          type="color"
          className={cn(fieldBase, inputClassName, "h-8 w-12 p-1 cursor-pointer shrink-0")}
          value={pickerValue}
          onChange={(e) => { beginGrouping(); setDraft(null); onChange(e.target.value); }}
          onBlur={endGrouping}
        />
        <input
          type="text"
          className={cn(fieldBase, fieldSizes.sm, inputClassName, "font-mono text-xs")}
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
        <IconButton
          icon={Ban}
          label="Прозрачный"
          variant="secondary"
          pressed={isTransparent}
          className={cn(isTransparent && "border-primary/60")}
          onClick={() => { setDraft(null); onChange(isTransparent ? pickerValue : "transparent"); }}
        />
      </div>
    </div>
  );
}
