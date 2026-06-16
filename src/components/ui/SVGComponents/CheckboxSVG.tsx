"use client";

import React from "react";
import {LeafElement} from "@/types/editorElement.type";

type CheckboxProps = {
  element: LeafElement;
};

export function Checkbox({element}: CheckboxProps) {
  const {
    checked = false,
    label = "Checkbox",
    color = "#3b82f6",
    strokeColor = "#94a3b8",
    textColor = "#f1f5f9",
    backgroundColor = "#0f172a",
    w,
    h,
  } = element;

  const safeWidth = Math.max(1, w || 0);
  const safeHeight = Math.max(1, h || 0);
  const boxSize = Math.min(safeHeight - 8, 22, safeWidth * 0.25);
  const boxX = 4;
  const boxY = (safeHeight - boxSize) / 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      preserveAspectRatio="none"
      style={{display: "block"}}
    >
      <rect
        x={boxX}
        y={boxY}
        width={boxSize}
        height={boxSize}
        rx={4}
        fill={checked ? color : backgroundColor}
        stroke={strokeColor}
        strokeWidth={2}
      />
      {checked ? (
        <path
          d={`M ${boxX + boxSize * 0.22} ${boxY + boxSize * 0.52} L ${boxX + boxSize * 0.42} ${boxY + boxSize * 0.72} L ${boxX + boxSize * 0.8} ${boxY + boxSize * 0.28}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <text
        x={boxX + boxSize + 8}
        y={safeHeight / 2}
        dominantBaseline="middle"
        fill={textColor}
        fontSize={Math.min(14, safeHeight * 0.45)}
        fontFamily="Arial, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
