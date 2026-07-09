"use client";

import React from "react";
import { Circle } from "react-konva";
import Konva from "konva";
import type { ThemeColors } from "../types";

interface AnchorProps {
  x: number;
  y: number;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  themeColors: ThemeColors;
}

/** Перетаскиваемый маркер (ресайз/вершина). Снаппинг делает переданный onDragMove. */
export function Anchor({ x, y, onDragMove, themeColors }: AnchorProps) {
  return (
    <Circle
      x={x}
      y={y}
      radius={5}
      fill={themeColors.anchorFill}
      stroke={themeColors.anchorStroke}
      strokeWidth={2}
      draggable
      onDragMove={onDragMove}
      onDragStart={(e) => { e.cancelBubble = true; }}
      hitStrokeWidth={10}
      onMouseEnter={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "pointer";
      }}
      onMouseLeave={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "default";
      }}
    />
  );
}
