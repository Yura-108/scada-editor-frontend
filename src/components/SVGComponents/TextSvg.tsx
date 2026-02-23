"use client";

import React from "react";
import { BaseElement } from "@/types/editorElement.type"; // или DiagramElement — как у тебя называется тип

interface TextProps {
  element: BaseElement;
}

export const Text: React.FC<TextProps> = ({ element }) => {
  // Деструктуризация с дефолтными значениями
  const {
    text = "Text",
    fontSize = 16,
    color = "#e2e8f0",
    background = false,
    backgroundColor = "#0f172a",
    align = "center",
    bold = false,
    // Если в будущем захочешь задавать размер через свойства элемента
    width: customWidth,
    height: customHeight,
  } = element;

  // Размеры — берём из element.w / element.h, если они есть (от Rnd), иначе дефолт
  const width = customWidth ?? element.w ?? 160;
  const height = customHeight ?? element.h ?? 50;

  const lines = text.split("\n");

  const getTextAnchor = () => {
    switch (align) {
      case "left":
        return "start";
      case "right":
        return "end";
      default:
        return "middle";
    }
  };

  const getX = () => {
    switch (align) {
      case "left":
        return 8;
      case "right":
        return width - 8;
      default:
        return width / 2;
    }
  };

  const lineHeight = fontSize * 1.2;
  const totalTextHeight = lines.length * lineHeight;
  const startY = height / 2 - (totalTextHeight - lineHeight) / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="max-w-full max-h-full"
    >
      {/* Фон (если включён) */}
      {background && (
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx="6"
          fill={backgroundColor}
          stroke={element.strokeColor || "#334155"}
          strokeWidth={element.strokeWidth || 1}
        />
      )}

      {/* Текст с переносами строк */}
      {lines.map((line, index) => (
        <text
          key={index}
          x={getX()}
          y={startY + index * lineHeight}
          textAnchor={getTextAnchor()}
          dominantBaseline="middle"
          fontSize={fontSize}
          fill={color}
          fontWeight={bold ? 600 : 400}
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing={element.letterSpacing || 0}
        >
          {line}
        </text>
      ))}
    </svg>
  );
};