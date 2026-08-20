"use client";

import React, { useEffect, useRef, useState } from "react";
import { beginHistoryGroup, cancelHistoryGroup, endHistoryGroup } from "@/lib/editor/historyGroup";

interface TextInputProps {
  id?: string;
  /** undefined — значение не определено (у выделенных элементов оно разное). */
  value: string | undefined;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Строка, которая применяется СРАЗУ при вводе, а не по Enter.
 *
 * Точный аналог NumberInput и по той же причине: в панели свойств цвет и переключатели
 * применяются мгновенно, и ждать Enter от текстового поля пользователю неоткуда узнать.
 *
 * Сдерживало живой ввод одно — история undo: `onChange`, пишущий прямо в стор, создавал шаг
 * на КАЖДЫЙ символ, и набранное слово приходилось стирать двадцатью Ctrl+Z. Вся правка от
 * первого нажатия до потери фокуса склеивается в один шаг (`historyGroup`, тот же приём, что
 * у ведения по палитре цвета). Пересчёт схемы на символ дешёвый: `updateElementVisual`
 * трогает один элемент, а фигуры на холсте мемоизированы поэлементно.
 *
 * Escape возвращает строку, которая была до начала правки, и не оставляет следа в истории.
 */
export function TextInput({ id, value, onCommit, className, placeholder }: TextInputProps) {
  // draft === null — поле не редактируется и просто показывает значение из стора
  // (так оно само следует за undo/redo и сменой выделенного элемента).
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Значение на момент начала правки — к нему возвращает Escape.
  const initialRef = useRef<string | undefined>(undefined);
  const groupingRef = useRef(false);

  const beginGrouping = () => {
    if (groupingRef.current) return;
    groupingRef.current = true;
    initialRef.current = value ?? "";
    beginHistoryGroup();
  };
  const endGrouping = () => {
    if (!groupingRef.current) return;
    groupingRef.current = false;
    endHistoryGroup();
  };
  const cancelGrouping = () => {
    if (!groupingRef.current) return;
    groupingRef.current = false;
    cancelHistoryGroup();
  };
  // Страховка: элемент могли снять с выделения прямо во время правки —
  // без этого история осталась бы на паузе навсегда.
  useEffect(() => endGrouping, []);

  const displayed = draft ?? value ?? "";

  const apply = (raw: string) => {
    if (raw === (value ?? "")) return;
    beginGrouping();
    onCommit(raw);
  };

  const finish = (raw: string) => {
    setDraft(null);
    apply(raw);
    endGrouping();
  };

  const cancel = () => {
    const initial = initialRef.current;
    setDraft(null);
    if (groupingRef.current && initial !== undefined && initial !== (value ?? "")) onCommit(initial);
    cancelGrouping();
    inputRef.current?.blur();
  };

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className}
      value={displayed}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        apply(e.target.value);
      }}
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish((e.target as HTMLInputElement).value);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
    />
  );
}
