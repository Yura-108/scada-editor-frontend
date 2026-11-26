'use client';

import React from 'react';
import { Minus, Plus, Maximize, RotateCcw, FileText, Monitor } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { IconButton } from '@/shared/ui/IconButton';
import { ZoomPercentField } from './ZoomPercentField';

interface ZoomControlsProps {
  zoom: number;
  /** Шаг по ряду масштабов: 1 — «+», −1 — «−». */
  onZoomStep: (direction: 1 | -1) => void;
  /** Масштаб, введённый в поле процентов. */
  onZoomTo: (zoom: number) => void;
  onFit: () => void;
  onFitSheet: () => void;
  onReset: () => void;
  /** Фиксацию вида настраивают в редакторе. */
  readOnly: boolean;
  /** У сцены есть зафиксированный для монитора вид (см. core/scene/sheet/monitorView.ts). */
  viewLocked: boolean;
  /** Редактор: зафиксировать текущий вид для монитора или снять фиксацию. */
  onToggleViewLock: () => void;
}

/**
 * Панель зума в углу холста: −/+, текущий %, «вписать схему», «вписать лист», «100%» и
 * фиксация вида для монитора.
 *
 * В редакторе фиксируется текущий ракурс для монитора. Монитор с заданным ракурсом
 * показывает индикатор и поддерживает прокрутку колесом по вертикали.
 *
 * Смещение справа берётся из CSS-переменной `--ws-right-m` (ширина открытой
 * правой панели редактора), чтобы панель зума не пряталась под ней. В мониторе
 * переменной нет — работает запасное значение 0px.
 */
export function ZoomControls({
  zoom,
  onZoomStep,
  onZoomTo,
  onFit,
  onFitSheet,
  onReset,
  readOnly,
  viewLocked,
  onToggleViewLock,
}: ZoomControlsProps) {
  const panel =
    'absolute bottom-4 z-toolbar flex items-center gap-0.5 rounded-lg border bg-card/90 backdrop-blur px-1.5 py-1 shadow-lg select-none transition-[right] duration-300 ease-in-out';
  const style = { right: 'calc(var(--ws-right-m, 0px) + 16px)' };

  if (readOnly && viewLocked) {
    return (
      <div
        style={style}
        className={cn(panel, 'px-2.5 py-1.5 gap-1.5 text-xs text-muted-foreground')}
        title="Вид схемы зафиксирован в редакторе: масштаб и положение не меняются, прокрутка — колесом по вертикали"
      >
        <Monitor size={14} aria-hidden />
        Вид схемы задан
      </div>
    );
  }

  return (
    <div style={style} className={panel}>
      <IconButton icon={Minus} label="Уменьшить" onClick={() => onZoomStep(-1)} />
      <ZoomPercentField zoom={zoom} onZoomTo={onZoomTo} />
      <IconButton icon={Plus} label="Увеличить" onClick={() => onZoomStep(1)} />
      <div className="mx-0.5 h-4 w-px bg-border" />
      <IconButton icon={Maximize} label="Вписать схему" onClick={onFit} />
      <IconButton icon={FileText} label="Вписать лист" onClick={onFitSheet} />
      <IconButton icon={RotateCcw} label="Сбросить масштаб (100%)" onClick={onReset} />
      {!readOnly && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" />
          {/* Значок монитора с подписью, а не замок: замок читался как «редактирование
              заблокировано» (#18 п. 4). Нажатая кнопка — вид зафиксирован. */}
          <button
            type="button"
            aria-pressed={viewLocked}
            onClick={onToggleViewLock}
            title={
              viewLocked
                ? 'Вид для монитора зафиксирован (рамка на холсте) — нажмите, чтобы снять'
                : 'Зафиксировать этот вид для монитора: оператор увидит схему так и не сможет её зумить и двигать'
            }
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
              viewLocked
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Monitor size={14} />
            {viewLocked ? 'Вид монитора задан' : 'Вид монитора'}
          </button>
        </>
      )}
    </div>
  );
}
