"use client";

import React, { useState } from "react";
import { LeafElement } from "@/types/editorElement.type";

type ButtonProps = {
  element: LeafElement;
};

export function Button({ element }: ButtonProps) {
  const {
    color = "#FF4D4F",
    label = "Button",
    textColor = "#ffffff",
    pressed = false,
    id,
    w,
    h,
  } = element;

  const [hovered, setHovered] = useState(false);

  // Внутренние отступы
  const padding = 6;
  const radius = 6;
  const safeWidth = Math.max(1, w || 0);
  const safeHeight = Math.max(1, h || 0);
  const innerWidth = Math.max(0, safeWidth - padding * 2);
  const innerHeight = Math.max(0, safeHeight - padding * 2);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        {/* Лёгкий градиент сверху */}
        <linearGradient id={`btn-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.05" />
        </linearGradient>

        {/* Подсветка при наведении */}
        <filter id={`btn-glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="4"
            floodColor={color}
            floodOpacity="0.6"
          />
        </filter>
      </defs>

      {/* Основная форма кнопки */}
      <rect
        x={padding}
        y={pressed ? padding + 2 : padding}
        width={innerWidth}
        height={innerHeight}
        rx={radius}
        fill={color}
        stroke={hovered ? "#ffffff" : "#222"}
        strokeWidth={2}
        filter={hovered ? `url(#btn-glow-${id})` : "none"}
        style={{ transition: "all 0.15s ease" }}
      />

      {/* Градиентный блик */}
      <rect
        x={padding}
        y={pressed ? padding + 2 : padding}
        width={innerWidth}
        height={Math.max(0, innerHeight * 0.45)}
        rx={radius}
        fill={`url(#btn-grad-${id})`}
        pointerEvents="none"
      />

      {/* Текст */}
      <text
        x={safeWidth / 2}
        y={safeHeight / 2 + (pressed ? 2 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={Math.min(safeWidth, safeHeight) * 0.22}
        fontFamily="Arial, sans-serif"
        fontWeight="600"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>
    </svg>
  );
}
