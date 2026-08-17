"use client";

import React, { useRef, useState } from "react";

interface NumberInputProps {
  id?: string;
  /** undefined — значение не определено (у выделенных элементов оно разное). */
  value: number | undefined;
  onCommit: (value: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

/**
 * Числовое поле, которое отдаёт значение по blur / Enter, а не на каждый символ.
 *
 * Наивный `onChange={e => update(Number(e.target.value) || 0)}` ломает ввод:
 * чтобы перенабрать значение, поле сначала очищают — и в этот момент в элемент
 * улетает 0 (элемент прыгает в начало координат или схлопывается до MIN_SIZE).
 * Промежуточные состояния «-», «1.» тоже дают 0. Вдобавок каждое нажатие клавиши
 * создавало отдельную запись в истории undo.
 *
 * Пока поле в фокусе, значение живёт в локальном стейте; наружу уходит только
 * законченный ввод. Escape отменяет правку.
 */
export function NumberInput({
  id,
  value,
  onCommit,
  className,
  min,
  max,
  step = 1,
  placeholder,
}: NumberInputProps) {
  const asText = (v: number | undefined) => (v === undefined ? "" : String(v));

  // draft === null — поле не редактируется и просто показывает значение из стора
  // (так оно само следует за undo/redo, перетаскиванием мышью и сменой элемента,
  // без синхронизации через эффект).
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayed = draft ?? asText(value);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    setDraft(null); // в любом случае возвращаемся к значению из стора

    // Пустой ввод и промежуточный «-» — это не 0, а «пользователь ещё печатает».
    if (trimmed === "" || trimmed === "-") return;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;

    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);

    if (next !== value) onCommit(next);
  };

  return (
    <input
      ref={inputRef}
      id={id}
      type="number"
      className={className}
      value={displayed}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(null);
          inputRef.current?.blur();
        }
      }}
    />
  );
}
