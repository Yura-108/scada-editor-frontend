"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import type { CanvasMenuItem } from "./types";

interface CanvasContextMenuProps {
  menu: { x: number; y: number; items: CanvasMenuItem[] } | null;
}

// Отступ от края экрана, чтобы меню не прилипало вплотную к границе.
const MARGIN = 8;

/**
 * Кастомное контекстное меню холста.
 * position: fixed + clientX/clientY — координаты уже в системе окна, поэтому
 * меню не обрезается overflow-hidden контейнера холста. Позиция зажимается в
 * пределах экрана (переворот к курсору у правого/нижнего края), а высокое меню
 * получает max-height и прокрутку — все пункты остаются доступны.
 */
export function CanvasContextMenu({ menu }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!menu || !el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Не влезает справа/снизу — сдвигаем внутрь экрана (но не левее/выше отступа).
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - rect.width);
    if (top + rect.height > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - rect.height);

    // Измеряем в layout-фазе и позиционируем до отрисовки — без мигания.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ left, top });
  }, [menu]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos?.top ?? menu.y,
        left: pos?.left ?? menu.x,
        zIndex: 9999,
        // Пока не измерили — прячем, чтобы не мигнуло в необрезанной позиции.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div
        style={{ maxHeight: `calc(100vh - ${MARGIN * 2}px)` }}
        className="min-w-40 overflow-y-auto bg-white dark:bg-neutral-800 rounded-md p-1 shadow-xl border border-gray-200 dark:border-neutral-700"
      >
        {menu.items.map((item, idx) => (
          <div
            key={idx}
            onClick={item.onClick}
            className="group flex items-center px-3 py-2 text-sm outline-none cursor-default rounded-sm text-gray-700 dark:text-white hover:bg-indigo-500 hover:text-white whitespace-nowrap"
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
