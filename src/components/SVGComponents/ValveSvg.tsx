"use client";

import React from "react";
import { BaseElement } from "@/types/editorElement.type"; // или DiagramElement

type ValveStatus = "open" | "closed" | "error";

interface ValveProps {
  element: BaseElement;
}

export const Valve: React.FC<ValveProps> = ({ element }) => {
  // Деструктуризация с дефолтными значениями
  const {
    status = "closed" as ValveStatus,
    label,
    size: propSize,
    colorOpen = "#16a34a",    // зелёный — открыто
    colorClosed = "#0f172a",  // тёмный — закрыто
    colorError = "#dc2626",   // красный — ошибка
  } = element;

  // Размер — приоритет: element.size → element.w → дефолт 80
  const size = propSize ?? element.w ?? 80;

  const center = size / 2;
  const radius = size / 3;

  // Определяем цвет в зависимости от статуса
  const getColor = () => {
    switch (status) {
      case "open":
        return colorOpen;
      case "error":
        return colorError;
      case "closed":
      default:
        return colorClosed;
    }
  };

  const valveColor = getColor();

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="max-w-full max-h-full"
    >
      {/* Труба / линия */}
      <line
        x1="0"
        y1={center}
        x2={size}
        y2={center}
        stroke="#94a3b8"
        strokeWidth={Math.max(4, size / 13)} // адаптивная толщина
      />

      {/* Корпус клапана */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="white"
        stroke={valveColor}
        strokeWidth={Math.max(3, size / 20)}
      />

      {/* Крест внутри клапана (X) */}
      <line
        x1={center - radius / 1.5}
        y1={center - radius / 1.5}
        x2={center + radius / 1.5}
        y2={center + radius / 1.5}
        stroke={valveColor}
        strokeWidth={Math.max(2.5, size / 26)}
      />
      <line
        x1={center - radius / 1.5}
        y1={center + radius / 1.5}
        x2={center + radius / 1.5}
        y2={center - radius / 1.5}
        stroke={valveColor}
        strokeWidth={Math.max(2.5, size / 26)}
      />

      {/* Лейбл под клапаном (если есть) */}
      {label && (
        <text
          x={center}
          y={size + 18}               // чуть ниже SVG
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={Math.max(11, size / 5.7)}
          fill="#bdbacf"
          fontFamily="Inter, sans-serif"
          fontWeight="500"
        >
          {label}
        </text>
      )}
    </svg>
  );
};