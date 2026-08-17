"use client";

import React, { useRef } from "react";
import { Circle } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { GRID } from "@/lib/utils";
import { useEditorStore } from "@/store/useEditorStore";

interface CircleResizeHandleProps {
  cx: number;
  cy: number;
  r: number;
  elKey: string;
  snap: (v: number) => number;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  circleRef: React.RefObject<Konva.Circle | null>;
}

export function CircleResizeHandle({ cx, cy, r, elKey, snap, updateElementVisual, circleRef }: CircleResizeHandleProps) {
  const handleRef = useRef<Konva.Circle>(null);
  // Экранно-постоянный размер ручки (см. Anchor).
  const zoom = useEditorStore(s => s.camera.zoom);

  return (
    <Circle
      ref={handleRef}
      name="resize-handle"
      x={cx + r}
      y={cy}
      radius={8 / zoom}
      fill="transparent"
      stroke="transparent"
      hitStrokeWidth={12 / zoom}
      draggable
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => {
        const dx = e.target.x() - cx;
        const dy = e.target.y() - cy;
        const newR = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        // Зажимаем handle на горизонтальной оси
        e.target.y(cy);
        // Обновляем круг императивно — без React ре-рендера
        circleRef.current?.radius(newR);
        circleRef.current?.getLayer()?.batchDraw();
      }}
      onDragEnd={(e) => {
        const dx = e.target.x() - cx;
        const dy = e.target.y() - cy;
        const newR = Math.max(GRID, snap(Math.sqrt(dx * dx + dy * dy)));
        // Сначала обновляем Konva-узлы до снаппленного значения — убираем визуальный прыжок
        e.target.position({ x: cx + newR, y: cy });
        circleRef.current?.radius(newR);
        circleRef.current?.getLayer()?.batchDraw();
        updateElementVisual(elKey, { radius: newR, w: newR * 2, h: newR * 2 });
      }}
      onMouseEnter={e => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "ew-resize";
      }}
      onMouseLeave={e => {
        const container = e.target.getStage()?.container();
        resetCanvasCursor(container);
      }}
    />
  );
}
