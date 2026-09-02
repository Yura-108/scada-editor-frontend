"use client";

import React from "react";
import { Minus, Plus, Maximize, RotateCcw, FileText } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomBy: (factor: number) => void;
  onFit: () => void;
  onFitSheet: () => void;
  onReset: () => void;
}

/**
 * Панель зума в углу холста: −/+, текущий %, «вписать схему», «вписать лист», «100%».
 *
 * Смещение справа берётся из CSS-переменной `--ws-right-m` (ширина открытой
 * правой панели редактора), чтобы панель зума не пряталась под ней. В мониторе
 * переменной нет — работает запасное значение 0px.
 */
export function ZoomControls({ zoom, onZoomBy, onFit, onFitSheet, onReset }: ZoomControlsProps) {
  const btn = "p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors";

  return (
    <div
      style={{ right: "calc(var(--ws-right-m, 0px) + 16px)" }}
      className="absolute bottom-4 z-toolbar flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur px-1.5 py-1 shadow-lg select-none transition-[right] duration-300 ease-in-out"
    >
      <button className={btn} onClick={() => onZoomBy(1 / 1.2)} title="Уменьшить">
        <Minus size={16} />
      </button>
      <span className="w-12 text-center text-xs font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button className={btn} onClick={() => onZoomBy(1.2)} title="Увеличить">
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
    </div>
  );
}
