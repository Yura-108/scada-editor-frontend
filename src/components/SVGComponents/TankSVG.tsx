"use client";

import React from "react";

type TankSVGProps = {
  width?: number;
  height?: number;
  level?: number; // 0 - 100 %
  fluidColor?: string;
  strokeColor?: string;
};

export default function TankSVG({
                                  width = 80,
                                  height = 160,
                                  level = 60,
                                  fluidColor = "#3b82f6",
                                  strokeColor = "#333",
                                }: TankSVGProps) {
  const normalizedLevel = Math.max(0, Math.min(100, level));
  const fluidHeight = (height - 20) * (normalizedLevel / 100);
  const fluidY = height - 10 - fluidHeight;

  const gradientId = `tankFluidGradient-${fluidColor.replace("#", "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>

      {/* Корпус резервуара */}
      <rect
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        rx={(width - 20) / 2}
        fill="#e5e7eb"
        stroke={strokeColor}
        strokeWidth="3"
      />

      {/* Жидкость */}
      <clipPath id="tankClip">
        <rect
          x={10}
          y={10}
          width={width - 20}
          height={height - 20}
          rx={(width - 20) / 2}
        />
      </clipPath>

      <g clipPath="url(#tankClip)">
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
          <stop offset="0%" stopColor={fluidColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={fluidColor} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Шкала уровня */}
      {Array.from({ length: 5 }).map((_, i) => {
        const y = 10 + ((height - 20) / 4) * i;
        return (
          <line
            key={i}
            x1={width - 15}
            x2={width - 5}
            y1={y}
            y2={y}
            stroke="#555"
            strokeWidth="1"
          />
        );
      })}

      {/* Процент текста */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
        fill="#111"
        fontWeight="bold"
      >
        {normalizedLevel}%
      </text>
    </svg>
  );
}