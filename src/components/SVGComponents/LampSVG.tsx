"use client";

import React from "react";
import { BaseElement } from "@/types/editorElement.type"; // или DiagramElement — как у тебя

interface LampProps {
  element: BaseElement;
}

export function Lamp({ element }: LampProps) {
  // Деструктуризация свойств с дефолтными значениями
  const {
    color = "#FFD700",           // основной цвет свечения (когда включено)
    size = 40,                   // размер лампы (диаметр корпуса)
    status = "off",              // "off" | "on" | "blinking" и т.д.
    colorOff = "#333333",        // цвет когда выключено
    glowIntensity = 0.3,         // сила свечения (0–1)
    showBase = true,             // показывать ли базу/цоколь
  } = element;

  // Определяем актуальный цвет в зависимости от состояния
  const currentFillColor =
    status === "on" || status === "blinking"
      ? color
      : colorOff;

  // Уменьшаем размер свечения при выключенном состоянии
  const effectiveGlowOpacity = status === "off" ? 0 : glowIntensity;

  // Уникальный ID градиента (чтобы не конфликтовать между несколькими лампами)
  const gradientId = `lampGlow-${element.id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 40 40`}
      className="max-w-full max-h-full"
    >
      {/* Светящийся эффект (фон) */}
      {effectiveGlowOpacity > 0 && (
        <circle
          cx="20"
          cy="20"
          r="14"                    // чуть больше корпуса для ореола
          fill={`url(#${gradientId})`}
          opacity={effectiveGlowOpacity}
        />
      )}

      {/* Корпус лампы */}
      <circle
        cx="20"
        cy="20"
        r="12"
        fill={currentFillColor}
        stroke="#444"
        strokeWidth="2"
      />

      {/* База / цоколь (если включено) */}
      {showBase && (
        <g>
          <rect x="16" y="28" width="8" height="6" fill="#555" rx="1" />
          <rect x="17" y="34" width="6" height="3" fill="#444" />
        </g>
      )}

      {/* Градиент свечения */}
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="60%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}