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

  // Форматирование значения
  const formattedValue =
    Number(value).toFixed(precision);

  // Размер шрифта значения — адаптивный, но не меньше 12px
  const valueFontSize = Math.max(12, height / 3);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="max-w-full max-h-full"
    >
      {/* Фон дисплея */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="8"
        fill={backgroundColor}
        stroke={element.strokeColor || "#334155"}
        strokeWidth={element.strokeWidth || 1}
      />

      {/* Основное значение */}
      <text
        x={width / 2}
        y={height / 2 - (unit ? 4 : 0)} // чуть выше, если есть единица
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
          x={width - 8}
          y={height - 8}
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