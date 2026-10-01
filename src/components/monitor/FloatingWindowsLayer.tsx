"use client";

import React, {useCallback, useLayoutEffect, useRef, useState} from "react";
import {GripVertical, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {
  closeFloatingWindow, focusFloatingWindow, useFloatingWindowsStore, type FloatingWindow,
} from "@/store/useFloatingWindowsStore";
import {clampHudPosition, readFloatingWindowPos, writeFloatingWindowPos} from "@/lib/editor/procedureHudPrefs";

const MARGIN = 8;
/** Сдвиг каждого следующего окна того же вида — чтобы второе не легло ровно поверх первого. */
const CASCADE = 28;

/**
 * Одно плавающее окно: шапка с ручкой перетаскивания, заголовком и крестиком, под ней
 * содержимое со своей прокруткой.
 *
 * Перетаскивание — тем же приёмом, что у `ProcedureHud`: во время жеста узел двигается через
 * `style`, в состояние пишем только на `pointerup` (иначе сотни перерисовок). Окно не уходит за
 * край области схемы (`clampHudPosition`), место запоминается на вид окна — следующее «Опции»
 * откроются там, где оператор держал прошлые.
 */
function FloatingWindowView({win, cascadeIndex}: {win: FloatingWindow; cascadeIndex: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{x: number; y: number} | null>(null);

  // Начальное место — когда известны размеры области: запомненное для вида или правый верх,
  // со сдвигом по числу уже открытых окон того же вида.
  useLayoutEffect(() => {
    const node = ref.current;
    const area = node?.parentElement;
    if (!node || !area || pos) return;
    const saved = readFloatingWindowPos(win.kind);
    const base = saved ?? {x: area.clientWidth - win.width - 16, y: 16};
    const shift = cascadeIndex * CASCADE;
    setPos(clampHudPosition(
      base.x + shift, base.y + shift,
      {width: node.offsetWidth, height: node.offsetHeight},
      {width: area.clientWidth, height: area.clientHeight},
      MARGIN,
    ));
  }, [pos, win.kind, win.width, cascadeIndex]);

  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    const area = node?.parentElement;
    if (!node || !area || e.button !== 0) return;
    // Кнопки в шапке (крестик) — не начало перетаскивания.
    if ((e.target as HTMLElement).closest("button")) return;

    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const box = node.getBoundingClientRect();
    const areaBox = area.getBoundingClientRect();
    const grabX = e.clientX - box.left;
    const grabY = e.clientY - box.top;
    const size = {width: box.width, height: box.height};
    const bounds = {width: area.clientWidth, height: area.clientHeight};
    let next = {x: box.left - areaBox.left, y: box.top - areaBox.top};

    const onMove = (ev: PointerEvent) => {
      next = clampHudPosition(ev.clientX - areaBox.left - grabX, ev.clientY - areaBox.top - grabY, size, bounds, MARGIN);
      node.style.left = `${next.x}px`;
      node.style.top = `${next.y}px`;
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setPos(next);
      writeFloatingWindowPos(win.kind, next);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, [win.kind]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={win.title}
      // Не модальное: фокус и клики вокруг остаются у схемы.
      aria-modal={false}
      onPointerDown={() => focusFloatingWindow(win.id)}
      className={cn(
        "absolute pointer-events-auto flex flex-col max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)]",
        "rounded-xl border border-neutral-200 dark:border-neutral-800",
        "bg-white/95 dark:bg-neutral-900/95 shadow-2xl backdrop-blur-xl",
        // До расчёта места не показываем: иначе окно мигнуло бы в левом верхнем углу.
        pos ? "opacity-100" : "opacity-0",
      )}
      style={{left: pos?.x ?? 0, top: pos?.y ?? 0, width: win.width, zIndex: 30 + win.z}}
    >
      <div
        onPointerDown={handleDragStart}
        className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-neutral-200 dark:border-neutral-800 cursor-grab active:cursor-grabbing touch-none select-none"
        title="Перетащить"
      >
        <GripVertical size={16} className="shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
          {win.title}
        </span>
        <button
          type="button"
          onClick={() => closeFloatingWindow(win.id)}
          className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
          title="Закрыть"
          aria-label={`Закрыть «${win.title}»`}
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-4">
        <React.Fragment key={win.nonce}>{win.content}</React.Fragment>
      </div>
    </div>
  );
}

/**
 * Слой плавающих окон монитора. Сам слой клики не ловит (`pointer-events-none`): схема под ним
 * работает как обычно, ловят только окна. Монтируется в области схемы (`relative`).
 */
export function FloatingWindowsLayer() {
  const windows = useFloatingWindowsStore(s => s.windows);
  if (!windows.length) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-toolbar">
      {windows.map(win => {
        const cascadeIndex = windows.filter(w => w.kind === win.kind).indexOf(win);
        // Родитель окна — сам слой: по нему окно меряет область для перетаскивания.
        return <FloatingWindowView key={win.id} win={win} cascadeIndex={cascadeIndex} />;
      })}
    </div>
  );
}
