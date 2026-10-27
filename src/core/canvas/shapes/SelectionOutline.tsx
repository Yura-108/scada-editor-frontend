"use client";

import React from "react";
import { Rect } from "react-konva";
import { useThemeColors } from "../useThemeColors";

/**
 * Пунктирная рамка выделенной фигуры.
 *
 * Один и тот же `<Rect fill="transparent" stroke="#3b82f6" dash={[4,3]} …>` был
 * скопирован в дюжину компонентов-виджетов с захардкоженным синим. Теперь цвет
 * берётся из палитры холста (`themeColors.selection`) в одном месте — и он же
 * используется рамкой-протяжкой и Transformer'ом, поэтому одновременно видимых
 * «двух разных синих» больше нет.
 */
export function SelectionOutline({
  x,
  y,
  width,
  height,
  cornerRadius,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}) {
  const { themeColors } = useThemeColors();

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={cornerRadius}
      fill="transparent"
      stroke={themeColors.selection}
      strokeWidth={1.5}
      dash={[4, 3]}
      listening={false}
    />
  );
}
