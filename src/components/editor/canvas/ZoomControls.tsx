"use client";

import React from "react";
import { Minus, Plus, Maximize, RotateCcw, FileText, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomControlsProps {
  zoom: number;
  /** Шаг в 1 процентный пункт: 1 — «+», −1 — «−». */
  onZoomStep: (direction: 1 | -1) => void;
  onFit: () => void;
  onFitSheet: () => void;
  onReset: () => void;
  /** Монитор: там замок не ставят — его выставляет инженер в редакторе. */
  readOnly: boolean;
  /** У сцены есть зафиксированный для монитора вид (см. lib/editor/monitorView.ts). */
  viewLocked: boolean;
  /** Редактор: зафиксировать текущий вид для монитора или снять фиксацию. */
  onToggleViewLock: () => void;
}

/**
 * Панель зума в углу холста: −/+, текущий %, «вписать схему», «вписать лист», «100%» и
 * замок вида для монитора.
 *
 * Замок действует НЕ здесь: в редакторе масштаб и пан всегда свободны, замок лишь
 * запоминает то, что сейчас видно, и в мониторе камера встаёт ровно так и больше не
 * двигается (только прокрутка колесом по вертикали). Поэтому в мониторе с зафиксированным
 * видом кнопок нет вовсе — остаётся значок, объясняющий, почему схема не зумится.
 *
 * Смещение справа берётся из CSS-переменной `--ws-right-m` (ширина открытой
 * правой панели редактора), чтобы панель зума не пряталась под ней. В мониторе
 * переменной нет — работает запасное значение 0px.
 */
export function ZoomControls({
  zoom, onZoomStep, onFit, onFitSheet, onReset, readOnly, viewLocked, onToggleViewLock,
}: ZoomControlsProps) {
  const btn = "p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors disabled:opacity-40 disabled:pointer-events-none";
  const panel = "absolute bottom-4 z-toolbar flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur px-1.5 py-1 shadow-lg select-none transition-[right] duration-300 ease-in-out";
  const style = { right: "calc(var(--ws-right-m, 0px) + 16px)" };

  if (readOnly && viewLocked) {
    return (
      <div style={style} className={cn(panel, "px-2.5 py-1.5 gap-1.5 text-xs text-neutral-600 dark:text-neutral-400")}
        title="Вид схемы зафиксирован в редакторе: масштаб и положение не меняются, прокрутка — колесом по вертикали">
        <Lock size={14} />
        Вид зафиксирован
      </div>
    );
  }

  return (
    <div style={style} className={panel}>
      <button className={btn} onClick={() => onZoomStep(-1)} title="Уменьшить на 1%">
        <Minus size={16} />
      </button>
      <span className="w-12 text-center text-xs font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button className={btn} onClick={() => onZoomStep(1)} title="Увеличить на 1%">
        <Plus size={16} />
      </button>
      <div className="mx-0.5 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
      <button className={btn} onClick={onFit} title="Вписать схему">
        <Maximize size={16} />
      </button>
      <button className={btn} onClick={onFitSheet} title="Вписать лист">
        <FileText size={16} />
      </button>
      <button className={btn} onClick={onReset} title="Сбросить масштаб (100%)">
        <RotateCcw size={16} />
      </button>
      {!readOnly && (
        <>
          <div className="mx-0.5 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
          <button
            className={cn(btn, viewLocked && "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400")}
            onClick={onToggleViewLock}
            aria-pressed={viewLocked}
            title={viewLocked
              ? "Вид для монитора зафиксирован (рамка на холсте) — нажмите, чтобы снять"
              : "Зафиксировать этот вид для монитора: оператор увидит схему так и не сможет её зумить и двигать"}
          >
            {viewLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </>
      )}
    </div>
  );
}
