"use client";

import React from "react";
import { LeafElement } from "@/types/editorElement.type";

interface TextProps {
  element: LeafElement;
}

export const Text: React.FC<TextProps> = ({ element }) => {
  const {
    text = "Text",
    fontSize = 16,
    color = "#e2e8f0",
    background = false,
    backgroundColor = "#0f172a",
    align = "center",
    bold = false,
    letterSpacing = 0,
    strokeColor = "#334155",
    strokeWidth = 1,
    w,
    h,
  } = element;

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
        return w - 8;
      default:
        return w / 2;
    }
  };

  const lineHeight = fontSize * 1.25;
  const totalHeight = lines.length * lineHeight;
  const startY = h / 2 - (totalHeight - lineHeight) / 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {/* Фон */}
      {background && (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={6}
          fill={backgroundColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* Текст */}
      {lines.map((line, i) => (
        <text
          key={i}
          x={getX()}
          y={startY + i * lineHeight}
          textAnchor={getTextAnchor()}
          dominantBaseline="middle"
          fontSize={fontSize}
          fill={color}
          fontWeight={bold ? 600 : 400}
          fontFamily="Inter, system-ui, sans-serif"
          letterSpacing={letterSpacing}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {line}
        </text>
      ))}
    </svg>
  );
};
