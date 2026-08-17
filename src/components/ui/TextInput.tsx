"use client";

import React, { useRef, useState } from "react";

interface TextInputProps {
  id?: string;
  /** undefined — значение не определено (у выделенных элементов оно разное). */
  value: string | undefined;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Текстовое поле, которое отдаёт значение по blur / Enter, а не на каждый символ.
 *
 * Точный аналог NumberInput для строк, и по той же причине: `onChange`, пишущий
 * прямо в стор, создавал новый массив `elements` на КАЖДЫЙ введённый символ. А
 * это шаг в истории undo на символ (набрал слово — стёр его двадцатью Ctrl+Z) и
 * полный пересчёт схемы с перерисовкой холста на каждое нажатие клавиши.
 *
 * Пока поле в фокусе, значение живёт в локальном стейте; наружу уходит только
 * законченный ввод. Escape отменяет правку.
 */
export function TextInput({ id, value, onCommit, className, placeholder }: TextInputProps) {
  // draft === null — поле не редактируется и просто показывает значение из стора
  // (так оно само следует за undo/redo и сменой выделенного элемента).
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayed = draft ?? value ?? "";

  const commit = (raw: string) => {
    setDraft(null);
    if (raw !== (value ?? "")) onCommit(raw);
  };

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className}
      value={displayed}
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
