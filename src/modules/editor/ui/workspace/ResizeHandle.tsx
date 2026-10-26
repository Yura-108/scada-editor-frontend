"use client";

import React from "react";
import type {PanelSide} from "./lib/workspaceLayout";

interface ResizeHandleProps {
  /** Сторона панели: ручка висит на её внутреннем крае. */
  side: PanelSide;
  label: string;
  value: number;
  min: number;
  max: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Ручка — separator с клавиатурой: стрелки меняют ширину на 16px,
 * Home/End — минимум/максимум, Enter сворачивает панель. Перетаскивание меняет
 * ширину, а при уходе за порог — сворачивает панель.
 */
export function ResizeHandle({side, label, value, min, max, onPointerDown, onKeyDown}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={side === "left"
        ? "absolute top-0 bottom-0 right-0 -mr-1.5 w-3 cursor-col-resize z-panel-handle group/handle"
        : "absolute top-0 bottom-0 left-0 -ml-1.5 w-3 cursor-col-resize z-panel-handle group/handle"}
    >
      <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-blue-500/50 group-focus/handle:bg-blue-500 transition-colors" />
    </div>
  );
}
