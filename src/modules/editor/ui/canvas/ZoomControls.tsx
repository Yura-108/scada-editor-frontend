"use client";

import React from "react";
import { Minus, Plus, Maximize, RotateCcw, FileText, Lock, Unlock } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {IconButton} from "@/shared/ui/IconButton";

interface ZoomControlsProps {
  zoom: number;
  /** Шаг в 1 процентный пункт: 1 — «+», −1 — «−». */
  onZoomStep: (direction: 1 | -1) => void;
  onFit: () => void;
  onFitSheet: () => void;
  onReset: () => void;
  /** Монитор: там замок не ставят — его выставляет инженер в редакторе. */
  readOnly: boolean;
  /** У сцены есть зафиксированный для монитора вид (см. core/scene/sheet/monitorView.ts). */
  viewLocked: boolean;
  /** Редактор: зафиксировать текущий вид для монитора или снять фиксацию. */
  onToggleViewLock: () => void;
}

/**
 * Панель зума в углу холста: −/+, текущий %, «вписать схему», «вписать лист», «100%» и
 * замок вида для монитора.
 *
 * Замок действует НЕ здесь: в редакторе масштаб и пан всегда свободны, замок лишь
 * запоминает то, что сейчас видно, и в мониторе камера встаёт ровно так и больше не
 * двигается (только прокрутка колесом по вертикали). Поэтому в мониторе с зафиксированным
 * видом кнопок нет вовсе — остаётся значок, объясняющий, почему схема не зумится.
 *
 * Смещение справа берётся из CSS-переменной `--ws-right-m` (ширина открытой
 * правой панели редактора), чтобы панель зума не пряталась под ней. В мониторе
 * переменной нет — работает запасное значение 0px.
 */
export function ZoomControls({
  zoom, onZoomStep, onFit, onFitSheet, onReset, readOnly, viewLocked, onToggleViewLock,
}: ZoomControlsProps) {
  const panel = "absolute bottom-4 z-toolbar flex items-center gap-0.5 rounded-lg border bg-card/90 backdrop-blur px-1.5 py-1 shadow-lg select-none transition-[right] duration-300 ease-in-out";
  const style = { right: "calc(var(--ws-right-m, 0px) + 16px)" };

  if (readOnly && viewLocked) {
    return (
      <div style={style} className={cn(panel, "px-2.5 py-1.5 gap-1.5 text-xs text-muted-foreground")}
        title="Вид схемы зафиксирован в редакторе: масштаб и положение не меняются, прокрутка — колесом по вертикали">
        <Lock size={14} />
        Вид зафиксирован
      </div>
    );
  }

  return (
    <div style={style} className={panel}>
      <IconButton icon={Minus} label="Уменьшить на 1%" onClick={() => onZoomStep(-1)} />
      <span className="w-12 text-center text-xs font-medium text-foreground tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <IconButton icon={Plus} label="Увеличить на 1%" onClick={() => onZoomStep(1)} />
      <div className="mx-0.5 h-4 w-px bg-border" />
      <IconButton icon={Maximize} label="Вписать схему" onClick={onFit} />
      <IconButton icon={FileText} label="Вписать лист" onClick={onFitSheet} />
      <IconButton icon={RotateCcw} label="Сбросить масштаб (100%)" onClick={onReset} />
      {!readOnly && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <IconButton
            icon={viewLocked ? Lock : Unlock}
            label="Зафиксировать вид для монитора"
            pressed={viewLocked}
            onClick={onToggleViewLock}
            title={viewLocked
              ? "Вид для монитора зафиксирован (рамка на холсте) — нажмите, чтобы снять"
              : "Зафиксировать этот вид для монитора: оператор увидит схему так и не сможет её зумить и двигать"}
          />
        </>
      )}
    </div>
  );
}
