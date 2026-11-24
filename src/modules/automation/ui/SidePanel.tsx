"use client";

import React, {useRef, useState} from "react";
import {PanelRightClose, PanelRightOpen} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {cn} from "@/shared/lib/cn";
import {fieldLabelSmClass as label} from "@/shared/ui/field/fieldStyles";
import {useSidePanelState, type SidePanelSize} from "../model/useSidePanelState";

const KEY_STEP = 16;

interface Props {
  /** Ключ памяти в браузере, например `automation.tagTree`. */
  storageKey: string;
  title: string;
  size: SidePanelSize;
  /**
   * Узкое окно: панель — полоса у края, а открытая ложится поверх формы, не отнимая у неё
   * ширину (#7 п. 1). Открытие в этом режиме не запоминается: при следующем заходе снова полоса.
   */
  overlay: boolean;
  children: React.ReactNode;
}

/**
 * Боковая панель справа «Автоматизации» (дерево тегов, шаблоны задач): ширина меняется
 * перетаскиванием левого края (или стрелками на нём), панель сворачивается в узкую полосу.
 */
export function SidePanel({storageKey, title, size, overlay, children}: Props) {
  const {open, setOpen, width, previewWidth, commitWidth} = useSidePanelState(storageKey, size);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const dragRef = useRef<{startX: number; startWidth: number} | null>(null);

  const shown = overlay ? overlayOpen : open;
  const show = (next: boolean) => (overlay ? setOverlayOpen(next) : setOpen(next));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {startX: e.clientX, startWidth: width};
  };
  // Панель справа: тянем край влево — панель шире.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag) previewWidth(drag.startWidth + drag.startX - e.clientX);
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    commitWidth(width);
  };
  const onHandleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") commitWidth(width + KEY_STEP);
    else if (e.key === "ArrowRight") commitWidth(width - KEY_STEP);
    else if (e.key === "Home") commitWidth(size.min);
    else if (e.key === "End") commitWidth(size.max);
    else if (e.key === "Enter") show(false);
    else return;
    e.preventDefault();
  };

  const strip = (
    <button
      type="button"
      onClick={() => show(!shown)}
      title={shown ? `Скрыть: ${title.toLowerCase()}` : `Показать: ${title.toLowerCase()}`}
      aria-label={shown ? `Скрыть панель «${title}»` : `Показать панель «${title}»`}
      aria-expanded={shown}
      className={cn(
        "shrink-0 w-9 h-full flex flex-col items-center gap-3 py-3 border-l border-border text-muted-foreground hover:bg-accent",
        shown && "bg-accent text-foreground",
      )}
    >
      {shown ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      <span className="text-xs [writing-mode:vertical-rl] rotate-180">{title}</span>
    </button>
  );

  if (!shown && !overlay) return strip;

  const panel = (
    <aside
      style={{width}}
      aria-label={title}
      onKeyDown={overlay ? e => { if (e.key === "Escape") { e.stopPropagation(); show(false); } } : undefined}
      className={cn(
        "shrink-0 h-full flex flex-col min-h-0 border-l border-border",
        overlay ? "absolute top-0 right-full z-drawer max-w-[calc(100vw-4rem)] bg-card shadow-2xl" : "relative",
      )}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Ширина панели «${title}»`}
        aria-valuenow={width}
        aria-valuemin={size.min}
        aria-valuemax={size.max}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onHandleKey}
        title="Потяните, чтобы изменить ширину"
        className="absolute top-0 bottom-0 left-0 -ml-1.5 w-3 cursor-col-resize z-10 group/handle touch-none"
      >
        <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-primary/60 group-focus/handle:bg-primary transition-colors" />
      </div>
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-3 pl-4">
        <span className={cn(label, "mb-0 truncate")}>{title}</span>
        <IconButton icon={PanelRightClose} label={`Свернуть панель «${title}»`} onClick={() => show(false)} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </aside>
  );

  if (!overlay) return panel;

  // Узкое окно: полоса остаётся на месте, открытая панель — слева от неё, поверх формы.
  return (
    <div className="relative shrink-0 h-full">
      {strip}
      {shown && panel}
    </div>
  );
}
