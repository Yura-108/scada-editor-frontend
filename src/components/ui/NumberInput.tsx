"use client";

import React, { useEffect, useRef, useState } from "react";
import { beginHistoryGroup, cancelHistoryGroup, endHistoryGroup } from "@/lib/editor/historyGroup";

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
 * Число, которое применяется СРАЗУ при вводе, а не по Enter.
 *
 * Ждать Enter в панели свойств неудобно: поменял многоугольнику число углов — и не видишь
 * результата, пока не нажмёшь клавишу, о которой ниоткуда не узнать. Цвет и переключатели в
 * той же панели применяются мгновенно, и число обязано вести себя так же.
 *
 * Две ловушки, из-за которых наивный `onChange={e => update(Number(e.target.value) || 0)}`
 * здесь не годится, — обе закрыты, а не обойдены отказом от живого ввода:
 *
 *  - **промежуточный ввод не число.** Чтобы перенабрать значение, поле сначала очищают, и в
 *    этот момент наружу улетал 0: элемент прыгал в начало координат или схлопывался до
 *    минимального размера. То же с «-», «1.» и «1e». Такой ввод просто не применяется — в
 *    сторе остаётся прежнее значение, а в поле видно то, что печатает пользователь;
 *  - **история undo.** Каждый символ создавал отдельный шаг, и набранное число приходилось
 *    отменять посимвольно. Вся правка от первого нажатия до потери фокуса склеивается в один
 *    шаг (`historyGroup`, тот же приём, что у ведения по палитре цвета и перетаскивания).
 *
 * Escape возвращает значение, которое было до начала правки, и не оставляет следа в истории.
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

  // Значение на момент начала правки — к нему возвращает Escape.
  const initialRef = useRef<number | undefined>(undefined);
  const groupingRef = useRef(false);

  const beginGrouping = () => {
    if (groupingRef.current) return;
    groupingRef.current = true;
    initialRef.current = value;
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

  const displayed = draft ?? asText(value);

  const clamp = (n: number) => {
    let next = n;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    return next;
  };

  /** Законченное ли это число. «», «-», «1.», «1e» — пользователь ещё печатает. */
  const isComplete = (raw: string) => /^-?\d+(\.\d+)?$/.test(raw);

  const apply = (raw: string, { partial }: { partial: boolean }) => {
    const trimmed = raw.trim();
    if (partial ? !isComplete(trimmed) : trimmed === "" || trimmed === "-") return;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;

    const next = clamp(parsed);
    if (next === value) return;

    beginGrouping();
    onCommit(next);
  };

  /** Завершение правки: доприменяем ввод и закрываем шаг истории. */
  const finish = (raw: string) => {
    setDraft(null);
    apply(raw, { partial: false });
    endGrouping();
  };

  const cancel = () => {
    const initial = initialRef.current;
    setDraft(null);
    if (groupingRef.current && initial !== undefined && initial !== value) onCommit(initial);
    cancelGrouping();
    inputRef.current?.blur();
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
      onChange={(e) => {
        setDraft(e.target.value);
        // Живое применение: стрелки ↑↓ и обычный набор сразу видны на холсте.
        apply(e.target.value, { partial: true });
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
