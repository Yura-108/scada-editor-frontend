"use client";

import React, {useCallback, useRef, useState} from "react";
import {PanelRightClose, PanelRightOpen} from "lucide-react";
import {cn} from "@/lib/utils";
import DeviceTreePanel from "@/components/channels/DeviceTreePanel";
import {fieldLabel as label} from "@/components/automation/formStyles";

const WIDTH_KEY = "automation.tagTree.width";
const OPEN_KEY = "automation.tagTree.open";
const MIN_WIDTH = 220;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 320;
const KEY_STEP = 16;

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));

/** localStorage может быть недоступен (приватный режим, запрет сайта) — тогда просто без памяти. */
const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // без памяти между заходами — не страшно
  }
};

/**
 * Дерево тегов справа от формы задачи: ширина меняется перетаскиванием левого края (или
 * стрелками на нём), панель сворачивается в узкую полосу. Оба значения помнит браузер.
 *
 * Раньше дерево стояло колонкой фиксированной ширины и высоты 600px и отнимало место у формы.
 */
export function TagTreeSidebar() {
  // Форма задачи появляется только после загрузки набора в браузере, на сервере эта панель не
  // рендерится — поэтому localStorage можно читать прямо в начальном состоянии.
  const [open, setOpen] = useState(() => readStored(OPEN_KEY) !== "0");
  const [width, setWidth] = useState(() => clampWidth(Number(readStored(WIDTH_KEY)) || DEFAULT_WIDTH));
  const dragRef = useRef<{startX: number; startWidth: number} | null>(null);

  const toggle = (next: boolean) => {
    setOpen(next);
    writeStored(OPEN_KEY, next ? "1" : "0");
  };

  const commitWidth = useCallback((w: number) => {
    const next = clampWidth(w);
    setWidth(next);
    writeStored(WIDTH_KEY, String(next));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {startX: e.clientX, startWidth: width};
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    // Панель справа: тянем край влево — панель шире.
    if (drag) setWidth(clampWidth(drag.startWidth + drag.startX - e.clientX));
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    commitWidth(width);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") commitWidth(width + KEY_STEP);
    else if (e.key === "ArrowRight") commitWidth(width - KEY_STEP);
    else if (e.key === "Home") commitWidth(MIN_WIDTH);
    else if (e.key === "End") commitWidth(MAX_WIDTH);
    else if (e.key === "Enter") toggle(false);
    else return;
    e.preventDefault();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        title="Показать дерево тегов"
        aria-label="Показать дерево тегов"
        className="shrink-0 w-9 flex flex-col items-center gap-3 py-3 border-l border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <PanelRightOpen size={16} />
        <span className="text-xs [writing-mode:vertical-rl] rotate-180">Дерево тегов</span>
      </button>
    );
  }

  return (
    <aside style={{width}} className="relative shrink-0 h-full flex flex-col gap-2 p-3 pl-4 border-l border-neutral-200 dark:border-neutral-800">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Ширина дерева тегов"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        title="Потяните, чтобы изменить ширину"
        className="absolute top-0 bottom-0 left-0 -ml-1.5 w-3 cursor-col-resize z-10 group/handle touch-none"
      >
        <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-blue-500/60 group-focus/handle:bg-blue-500 transition-colors" />
      </div>
      <div className="flex items-center justify-between">
        <span className={cn(label, "mb-0")}>Дерево тегов</span>
        <button
          type="button"
          onClick={() => toggle(false)}
          title="Свернуть дерево тегов"
          aria-label="Свернуть дерево тегов"
          className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <DeviceTreePanel fill />
      </div>
    </aside>
  );
}
