"use client";

import React from "react";
import type { CanvasMenuItem } from "./types";

interface CanvasContextMenuProps {
  menu: { x: number; y: number; items: CanvasMenuItem[] } | null;
}

/** Кастомное контекстное меню холста (позиционируется по клиентским координатам). */
export function CanvasContextMenu({ menu }: CanvasContextMenuProps) {
  if (!menu) return null;

  return (
    <div style={{ position: "absolute", top: menu.y, left: menu.x, zIndex: 9999 }}>
      <div className="min-w-40 bg-white dark:bg-neutral-800 rounded-md overflow-hidden p-1 shadow-xl border border-gray-200 dark:border-neutral-700">
        {menu.items.map((item, idx) => (
          <div
            key={idx}
            onClick={item.onClick}
            className="group flex items-center px-3 py-2 text-sm outline-none cursor-default rounded-sm text-gray-700 dark:text-white hover:bg-indigo-500 hover:text-white"
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
