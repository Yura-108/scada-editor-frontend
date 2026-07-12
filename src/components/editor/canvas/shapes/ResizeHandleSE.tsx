"use client";

import React from "react";
import { Rect } from "react-konva";
import { MIN_SIZE } from "../types";

interface Props {
  w: number;
  h: number;
  snap: (v: number) => number;
  onResize: (w: number, h: number) => void;
  /** true — тянем только ширину (высота фиксирована), ручка на правом крае по центру. */
  lockH?: boolean;
}

/** Квадратная ручка ресайза (нижний-правый угол или правый край при lockH). */
export function ResizeHandleSE({ w, h, snap, onResize, lockH }: Props) {
  const hy = lockH ? h / 2 : h;
  return (
    <Rect
      name="resize-handle"
      x={w}
      y={hy}
      width={8}
      height={8}
      offsetX={4}
      offsetY={4}
      fill="#ffffff"
      stroke="#3b82f6"
      strokeWidth={1.5}
      draggable
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => {
        const nw = Math.max(MIN_SIZE, snap(e.target.x()));
        const nh = lockH ? h : Math.max(MIN_SIZE, snap(e.target.y()));
        e.target.position({ x: nw, y: lockH ? h / 2 : nh });
        // Пишем в стор только при смене снапнутого значения — не на каждый пиксель.
        if (nw !== w || nh !== h) onResize(nw, nh);
      }}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = lockH ? "ew-resize" : "nwse-resize";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "default";
      }}
    />
  );
}
