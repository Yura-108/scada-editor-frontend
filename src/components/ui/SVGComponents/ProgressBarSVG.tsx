"use client";

import React from "react";
import {LeafElement} from "@/types/editorElement.type";

type ProgressBarProps = {
  element: LeafElement;
};

export function ProgressBar({element}: ProgressBarProps) {
  const {
    value = 0,
    color = "#3b82f6",
    backgroundColor = "#1e293b",
    strokeColor = "#475569",
    textColor = "#f8fafc",
    showPercentage = true,
    label = "",
    w,
    h,
  } = element;

  const safeWidth = Math.max(1, w || 0);
  const safeHeight = Math.max(1, h || 0);
  const padding = 4;
  const trackHeight = Math.max(8, safeHeight - padding * 2 - (label ? 14 : 0) - (showPercentage ? 16 : 0));
  const trackY = padding + (label ? 14 : 0);
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const fillWidth = (Math.max(0, safeWidth - padding * 2) * clamped) / 100;
  const radius = Math.min(6, trackHeight / 2);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      preserveAspectRatio="none"
      style={{display: "block"}}
    >
      {label ? (
        <text
          x={padding}
          y={padding + 10}
          fill={textColor}
          fontSize={11}
          fontFamily="Arial, sans-serif"
          fontWeight="600"
        >
          {label}
        </text>
      ) : null}

      <rect
        x={padding}
        y={trackY}
        width={Math.max(0, safeWidth - padding * 2)}
        height={trackHeight}
        rx={radius}
        fill={backgroundColor}
        stroke={strokeColor}
        strokeWidth={1}
      />
      <rect
        x={padding}
        y={trackY}
        width={fillWidth}
        height={trackHeight}
        rx={radius}
        fill={color}
      />

      {showPercentage ? (
        <text
          x={safeWidth / 2}
          y={trackY + trackHeight + 14}
          textAnchor="middle"
          fill={textColor}
          fontSize={11}
          fontFamily="monospace"
          fontWeight="600"
        >
          {clamped}%
        </text>
      ) : null}
    </svg>
  );
}
