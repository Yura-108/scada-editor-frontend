"use client";

import React from "react";
import { Group, Rect, Arc, Line, Text, Circle } from "react-konva";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

export function GaugeShapeElement({ el, isSelected, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const pad = 4;

  const w = rendered.w || 200;
  const h = rendered.h || 200;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 10;

  const minVal = rendered.min ?? 0;
  const maxVal = rendered.max ?? 100;
  const rawValue = Number(rendered.value ?? 60);
  const value = Math.max(minVal, Math.min(maxVal, rawValue));

  // arcStart/arcEnd задают диапазон в градусах относительно «правой» точки (0°)
  // По умолчанию: от -220° до 40° — дуга ~260°, открытая снизу
  const arcStartDeg = rendered.arcStart ?? -220;
  const arcEndDeg = rendered.arcEnd ?? 40;
  const totalArc = arcEndDeg - arcStartDeg; // напр. 260°

  const ratio = maxVal !== minVal ? (value - minVal) / (maxVal - minVal) : 0;
  const fillArc = ratio * totalArc;

  // Konva Arc: rotation от правой точки по часовой; angle задаёт размах
  // angle > 0 — по часовой
  const bgRotation = arcStartDeg; // начало фоновой дуги
  const bgAngle = totalArc;       // полный размах
  const fillRotation = arcStartDeg;
  const fillAngle = fillArc;

  // Стрелка: угол в радианах от центра
  const needleAngleDeg = arcStartDeg + fillArc;
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLen = radius * 0.75;
  const nx = cx + needleLen * Math.cos(needleAngleRad);
  const ny = cy + needleLen * Math.sin(needleAngleRad);

  const bgColor = rendered.backgroundColor || "#1e293b";
  const scaleColor = rendered.strokeColor || "#475569";
  const needleColor = rendered.color || "#3b82f6";
  const textCol = rendered.textColor || "#f8fafc";
  const unit = (rendered.unit as string) || "";
  const precision = Number(rendered.precision ?? 0);
  const showVal = rendered.showValue !== false;

  const displayValue = value.toFixed(precision) + (unit ? ` ${unit}` : "");

  // Засечки шкалы
  const tickCount = 9;
  const ticks: React.ReactElement[] = [];
  for (let i = 0; i <= tickCount; i++) {
    const tickRatio = i / tickCount;
    const tickAngleDeg = arcStartDeg + tickRatio * totalArc;
    const tickAngleRad = (tickAngleDeg * Math.PI) / 180;
    const isMajor = i % 2 === 0;
    const innerR = radius - (isMajor ? 14 : 8);
    const outerR = radius;
    ticks.push(
      <Line
        key={`tick-${i}`}
        points={[
          cx + innerR * Math.cos(tickAngleRad),
          cy + innerR * Math.sin(tickAngleRad),
          cx + outerR * Math.cos(tickAngleRad),
          cy + outerR * Math.sin(tickAngleRad),
        ]}
        stroke={scaleColor}
        strokeWidth={isMajor ? 2 : 1}
        listening={false}
      />
    );
  }

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <SelectionOutline x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} />
      )}

      {/* Фон */}
      <Rect x={0} y={0} width={w} height={h} fill={bgColor} cornerRadius={6} />

      {/* Фоновая дуга шкалы */}
      <Arc
        x={cx} y={cy}
        innerRadius={radius - 16}
        outerRadius={radius}
        angle={bgAngle}
        rotation={bgRotation}
        fill={scaleColor}
        listening={false}
      />

      {/* Заполненная дуга */}
      {fillAngle > 0 && (
        <Arc
          x={cx} y={cy}
          innerRadius={radius - 16}
          outerRadius={radius}
          angle={fillAngle}
          rotation={fillRotation}
          fill={needleColor}
          listening={false}
        />
      )}

      {/* Засечки */}
      {ticks}

      {/* Стрелка */}
      <Line
        points={[cx, cy, nx, ny]}
        stroke={needleColor}
        strokeWidth={3}
        lineCap="round"
        listening={false}
      />

      {/* Центральная точка */}
      <Circle x={cx} y={cy} radius={6} fill={needleColor} listening={false} />

      {/* Значение */}
      {showVal && (
        <Text
          x={0}
          y={cy + radius * 0.35}
          width={w}
          text={displayValue}
          fontSize={Math.max(12, Math.round(radius * 0.22))}
          fill={textCol}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
}
