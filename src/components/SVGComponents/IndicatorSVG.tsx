"use client";

import React from "react";
import { BaseElement } from "@/types/editorElement.type"; // или DiagramElement

interface IndicatorProps {
  element: BaseElement;
}

export function Indicator({ element }: IndicatorProps) {
  // Деструктуризация с дефолтными значениями
  const {
    status = "off",              // "off" | "on" | "error" | "warning" и т.д.
    colorOn = "#00FF00",         // зелёный — включено/нормальное состояние
    colorOff = "#444444",        // серый — выключено
    colorError = "#FF0000",      // красный — ошибка
    colorWarning = "#FFB800",    // жёлтый/оранжевый — предупреждение
    size = 30,                   // размер индикатора
    glowIntensity = 0.4,         // сила внутреннего свечения (0–1)
  } = element;

  // Определяем актуальный цвет в зависимости от статуса
  let currentColor: string;

  switch (status) {
    case "on":
    case "active":
      currentColor = colorOn;
      break;
    case "error":
      currentColor = colorError;
      break;
    case "warning":
      currentColor = colorWarning;
      break;
    case "off":
    default:
      currentColor = colorOff;
      break;
  }

  // Уменьшаем свечение при выключенном состоянии
  const effectiveGlowOpacity = status === "off" ? 0.1 : glowIntensity;

  // Уникальный ID градиента для каждой лампочки
  const gradientId = `indicatorGrad-${element.id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      className="max-w-full max-h-full"
    >
      {/* Корпус индикатора (тёмный фон) */}
      <circle
        cx="15"
        cy="15"
        r="12"
        fill="#222"
        stroke="#333"
        strokeWidth="2"
      />

      {/* Основной светящийся круг */}
      <circle
        cx="15"
        cy="15"
        r="6"
        fill={currentColor}
        stroke="#000"
        strokeWidth="1"
      />

      {/* Внутренний градиентный блик / свечение */}
      <circle
        cx="15"
        cy="15"
        r="6"
        fill={`url(#${gradientId})`}
        opacity={effectiveGlowOpacity}
      />

      {/* Определение градиента */}
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={currentColor} stopOpacity="0.85" />
          <stop offset="60%" stopColor={currentColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={currentColor} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}