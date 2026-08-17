"use client";

import React from "react";
import { Circle } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { useEditorStore } from "@/store/useEditorStore";
import type { ThemeColors } from "../types";

interface AnchorProps {
  x: number;
  y: number;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  themeColors: ThemeColors;
}

/**
 * Перетаскиваемый маркер (ресайз/вершина). Снаппинг делает переданный onDragMove.
 * Размер экранно-постоянный (делим на zoom): при отдалении ручка не превращается
 * в точку 1px, при приближении не разрастается. Подписка на zoom локальная —
 * ре-рендерится только сама ручка (только у выделенных элементов), не сцена.
 */
export function Anchor({ x, y, onDragMove, themeColors }: AnchorProps) {
  const zoom = useEditorStore(s => s.camera.zoom);

  return (
    <Circle
      name="resize-handle"
      x={x}
      y={y}
      radius={5 / zoom}
      fill={themeColors.anchorFill}
      stroke={themeColors.anchorStroke}
      strokeWidth={2 / zoom}
      draggable
      onDragMove={onDragMove}
      onDragStart={(e) => { e.cancelBubble = true; }}
      hitStrokeWidth={10 / zoom}
      onMouseEnter={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "pointer";
      }}
      onMouseLeave={e => {
        const container = e.target.getStage()?.container();
        resetCanvasCursor(container);
      }}
    />
  );
}
