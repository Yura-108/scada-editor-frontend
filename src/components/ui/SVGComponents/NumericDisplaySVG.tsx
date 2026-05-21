"use client";

import React from "react";
import { LeafElement } from "@/types/editorElement.type"; // или DiagramElement

interface NumericDisplayProps {
  element: LeafElement;
}

export const NumericDisplay: React.FC<NumericDisplayProps> = ({ element }) => {
  // Деструктуризация с дефолтными значениями
  const {
    value = 0,                   // значение (число или строка)
    unit = "",                   // единица измерения
    precision = 2,               // количество знаков после запятой
    color = "#22d3ee",           // цвет основного значения (cyan по умолчанию)
    backgroundColor = "#0f172a", // фон дисплея
    unitColor = "#94a3b8",       // цвет единицы измерения
    fontFamily = "monospace",    // шрифт (можно будет менять)
  } = element;

  // Размеры — приоритетно из react-rnd (w/h), иначе дефолт
  const width = element.w ?? 120;
  const height = element.h ?? 60;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);

  // Форматирование значения
  const formattedValue =
    Number(value).toFixed(precision);

  // Размер шрифта значения — адаптивный, но не меньше 12px
  const valueFontSize = Math.max(12, safeHeight / 3);

  return (
    <svg
      width={safeWidth}
      height={safeHeight}
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      className="max-w-full max-h-full"
    >
      {/* Фон дисплея */}
      <rect
        x="0"
        y="0"
        width={safeWidth}
        height={safeHeight}
        rx="8"
        fill={backgroundColor}
        stroke={element.strokeColor || "#334155"}
        strokeWidth={element.strokeWidth || 1}
      />

      {/* Основное значение */}
      <text
        x={safeWidth / 2}
        y={safeHeight / 2 - (unit ? 4 : 0)} // чуть выше, если есть единица
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={valueFontSize}
        fill={color}
        fontFamily={fontFamily}
        fontWeight="500"
        letterSpacing={element.letterSpacing || 0.5}
      >
        {formattedValue}
      </text>

      {/* Единица измерения (в правом нижнем углу) */}
      {unit && (
        <text
          x={safeWidth - 8}
          y={safeHeight - 8}
          textAnchor="end"
          dominantBaseline="auto"
          fontSize={Math.max(10, valueFontSize * 0.45)}
          fill={unitColor}
          fontFamily={fontFamily}
        >
          {unit}
        </text>
      )}
    </svg>
  );
};