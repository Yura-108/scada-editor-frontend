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
    orientation = "horizontal",
  } = element;

  const safeWidth = Math.max(1, w || 0);
  const safeHeight = Math.max(1, h || 0);
  const padding = 4;
  const isVertical = orientation === "vertical";

  // Reserve space for label and percentage text
  const reservedLabelH = label ? 14 : 0;
  const reservedPctH = showPercentage ? 16 : 0;

  // Track dimensions in the main axis
  const trackLength = isVertical
    ? Math.max(8, safeHeight - padding * 2 - reservedLabelH - reservedPctH)
    : Math.max(8, safeWidth - padding * 2);
  const trackThickness = isVertical
    ? Math.max(8, safeWidth - padding * 2 - reservedLabelH - reservedPctH)
    : Math.max(8, safeHeight - padding * 2 - reservedLabelH - reservedPctH);

  // Track origin
  const trackX = isVertical
    ? padding + reservedLabelH
    : padding;
  const trackY = isVertical
    ? padding
    : padding + reservedLabelH;

  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = Math.min(6, Math.min(trackLength, trackThickness) / 2);

  const fillLength = (trackLength * clamped) / 100;

  // Fill origin: for vertical, grow from bottom up; for horizontal, from left to right
  const fillX = isVertical ? trackX : trackX;
  const fillY = isVertical ? trackY + (trackLength - fillLength) : trackY;
  const fillW = isVertical ? trackThickness : fillLength;
  const fillH = isVertical ? fillLength : trackThickness;

  // Corner radii
  const trackRadius = isVertical
    ? [radius, radius, radius, radius]
    : radius;
  const fillRadius = isVertical
    ? (clamped >= 100 ? [radius, radius, radius, radius] : [0, 0, radius, radius])
    : (clamped >= 100 ? radius : [radius, 0, 0, radius]);

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
          x={isVertical ? padding : padding}
          y={isVertical ? safeHeight - padding - 4 : padding + 10}
          fill={textColor}
          fontSize={11}
          fontFamily="Arial, sans-serif"
          fontWeight="600"
        >
          {label}
        </text>
      ) : null}

      <rect
        x={trackX}
        y={trackY}
        width={isVertical ? trackThickness : trackLength}
        height={isVertical ? trackLength : trackThickness}
        rx={trackRadius}
        fill={backgroundColor}
        stroke={strokeColor}
        strokeWidth={1}
      />
      <rect
        x={fillX}
        y={fillY}
        width={fillW}
        height={fillH}
        rx={fillRadius}
        fill={color}
      />

      {showPercentage ? (
        <text
          x={isVertical ? trackX + trackThickness + 4 : safeWidth / 2}
          y={isVertical ? trackY + trackLength / 2 + 4 : trackY + trackThickness + 14}
          textAnchor={isVertical ? "start" : "middle"}
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
