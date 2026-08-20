"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasMenuItem } from "./types";

interface CanvasContextMenuProps {
  menu: { x: number; y: number; items: CanvasMenuItem[] } | null;
  /** Закрытие по Escape и клику вне меню. */
  onClose?: () => void;
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
export function CanvasContextMenu({ menu, onClose }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Раньше меню закрывалось только по mousedown на Stage, поэтому оставалось
  // висеть поверх интерфейса при клике по боковой панели или нажатии Escape.
  useEffect(() => {
    if (!menu || !onClose) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    // capture у Escape — чтобы меню закрылось раньше глобальных хоткеев редактора
    // (иначе тот же Escape заодно вышел бы из активной группы).
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menu, onClose]);

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
        zIndex: "var(--z-dropdown)",
        // Пока не измерили — прячем, чтобы не мигнуло в необрезанной позиции.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div
        style={{ maxHeight: `calc(100vh - ${MARGIN * 2}px)` }}
        className="min-w-40 overflow-y-auto bg-white dark:bg-neutral-800 rounded-md p-1 shadow-xl border border-gray-200 dark:border-neutral-700"
      >
        {/* disabled и variant раньше игнорировались: заблокированный пункт
            выглядел активным и вызывал обработчик, а «Удалить» не отличалось
            от обычных пунктов. */}
        {menu.items.map((item, idx) => (
          <button
            key={idx}
            type="button"
            disabled={item.disabled}
            onClick={item.disabled ? undefined : item.onClick}
            className={[
              "group flex w-full items-center px-3 py-2 text-sm text-left rounded-sm whitespace-nowrap",
              "focus-visible:outline-none focus-visible:bg-indigo-500 focus-visible:text-white",
              item.disabled
                ? "cursor-not-allowed opacity-40 text-gray-500 dark:text-neutral-500"
                : item.variant === "danger"
                  ? "cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                  : "cursor-pointer text-gray-700 dark:text-white hover:bg-indigo-500 hover:text-white",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
