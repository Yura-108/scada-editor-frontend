"use client";

import React from "react";

type TankProps = {
  element: DiagramElement;
};

export default function Tank({ element }: TankProps) {
  // Дефолты + значения из элемента
  const {
    level = 60,
    fluidColor = "#3b82f6",
    strokeColor = "#333333",
    backgroundColor = "#e5e7eb",
    showPercentage = true,
    textColor = "#111111",
    scaleLines = true,
    size = "medium",
  } = element;

  // Определяем размеры в зависимости от size-пресета
  let width = 80;
  let height = 160;

  if (size === "small") {
    width = 60;
    height = 120;
  } else if (size === "large") {
    width = 100;
    height = 200;
  }

  const normalizedLevel = Math.max(0, Math.min(100, level));
  const fluidHeight = (height - 20) * (normalizedLevel / 100);
  const fluidY = height - 10 - fluidHeight;

  const gradientId = `tankFluidGradient-${element.id}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>

      {/* Корпус резервуара */}
      <rect
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        rx={(width - 20) / 2}
        fill={backgroundColor}
        stroke={strokeColor}
        strokeWidth="3"
      />

      {/* Клиппинг для жидкости */}
      <clipPath id={`tankClip-${element.id}`}>
        <rect
          x={10}
          y={10}
          width={width - 20}
          height={height - 20}
          rx={(width - 20) / 2}
        />
      </clipPath>

      <g clipPath={`url(#tankClip-${element.id})`}>
        <rect
          x={10}
          y={fluidY}
          width={width - 20}
          height={fluidHeight}
          fill={`url(#${gradientId})`}
        />
      </g>

      {/* Градиент жидкости */}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fluidColor} stopOpacity="0.92" />
          <stop offset="100%" stopColor={fluidColor} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Шкала уровня (если включена) */}
      {scaleLines &&
        Array.from({ length: 5 }).map((_, i) => {
          const y = 10 + ((height - 20) / 4) * i;
          return (
            <line
              key={i}
              x1={width - 15}
              x2={width - 5}
              y1={y}
              y2={y}
              stroke="#555"
              strokeWidth="1.5"
            />
          );
        })}

      {/* Процент текста (если включён) */}
      {showPercentage && (
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={Math.min(width / 5, 18)}
          fill={textColor}
          fontWeight="bold"
        >
          {Math.round(normalizedLevel)}%
        </text>
      )}
    </svg>
  );
}