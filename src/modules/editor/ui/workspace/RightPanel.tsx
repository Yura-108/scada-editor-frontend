'use client';

import React from 'react';
import { PanelRight, PanelRightClose } from 'lucide-react';
import { IconButton } from '@/shared/ui/IconButton';
import { RIGHT_COLLAPSE, RIGHT_MAX } from './lib/workspaceLayout';
import { ResizeHandle } from './ResizeHandle';
import { SelectionProperties } from './SelectionProperties';

interface RightPanelProps {
  width: number;
  /** Панель видна: вкладка «Редактор» и не свёрнута. */
  shown: boolean;
  /** Не свёрнута (независимо от вкладки). */
  visible: boolean;
  showEditorPanels: boolean;
  resizing: boolean;
  setVisible: (visible: boolean) => void;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeKey: (e: React.KeyboardEvent) => void;
}

/** Правая панель — абсолютная, прилипшая к правому краю: свойства выделенного. */
export function RightPanel({
  width,
  shown,
  visible,
  showEditorPanels,
  resizing,
  setVisible,
  onResizeStart,
  onResizeKey,
}: RightPanelProps) {
  const togglePanel = (next: boolean) => {
    setVisible(next);
    requestAnimationFrame(() =>
      document.getElementById(next ? 'right-panel-collapse' : 'right-panel-expand')?.focus(),
    );
  };

  return (
    <div
      role={shown ? 'complementary' : undefined}
      aria-label={shown ? 'Свойства' : undefined}
      // Лежит поверх холста — «вписать» не уводит схему под неё (canvas/lib/visibleArea).
      data-canvas-overlay="right"
      style={{ width: 'var(--ws-right-w)' }}
      className={`absolute right-0 top-0 bottom-0 z-panel border-l border-border bg-card dark:bg-card/80 backdrop-blur-md ease-in-out ${
        resizing ? 'transition-none' : 'transition-transform duration-300'
      } ${shown ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div inert={!shown} className="h-full w-full overflow-y-auto">
        <h2 className="sr-only">Панель свойств</h2>
        <SelectionProperties />
      </div>

      {/* Кнопка СВЕРНУТЬ — в правом верхнем углу самой панели, у её заголовка, а не стрелкой
          «>» на середине холста поверх схемы (#18 п. 3). */}
      <IconButton
        id="right-panel-collapse"
        icon={PanelRightClose}
        label="Свернуть панель свойств"
        tabIndex={shown ? 0 : -1}
        aria-hidden={!shown}
        className="absolute top-2.5 right-2.5 z-10"
        onClick={() => togglePanel(false)}
      />

      {/* Кнопка РАЗВЕРНУТЬ правую панель */}
      <button
        id="right-panel-expand"
        type="button"
        onClick={() => togglePanel(true)}
        aria-label="Развернуть панель «Свойства»"
        title="Развернуть панель свойств"
        className={`absolute top-4 right-full flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium bg-card border border-border rounded-l-md text-foreground hover:bg-accent shadow-xl ${
          visible || !showEditorPanels ? 'invisible' : ''
        }`}
      >
        <PanelRight size={16} />
        Свойства
      </button>

      {shown && (
        <ResizeHandle
          side="right"
          label="Ширина панели свойств"
          value={width}
          min={RIGHT_COLLAPSE}
          max={RIGHT_MAX}
          onPointerDown={onResizeStart}
          onKeyDown={onResizeKey}
        />
      )}
    </div>
  );
}
