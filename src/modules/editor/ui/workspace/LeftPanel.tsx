'use client';

import React from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { IconButton } from '@/shared/ui/IconButton';
import { Tabs, tabPanelProps, type TabItem } from '@/shared/ui/Tabs';
import { LayersPanel } from '../layers-panel/LayersPanel';
import Palette from '../palette/Palette';
import { LEFT_COLLAPSE, LEFT_MAX, type LeftTabType } from './lib/workspaceLayout';
import { ResizeHandle } from './ResizeHandle';

interface LeftPanelProps {
  width: number;
  /** Панель видна: вкладка «Редактор» и не свёрнута. */
  shown: boolean;
  /** Не свёрнута (независимо от вкладки). */
  visible: boolean;
  showEditorPanels: boolean;
  resizing: boolean;
  leftTab: LeftTabType;
  setLeftTab: (tab: LeftTabType) => void;
  setVisible: (visible: boolean) => void;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeKey: (e: React.KeyboardEvent) => void;
}

const LEFT_TAB_ITEMS: TabItem<LeftTabType>[] = [
  { value: 'palette', label: 'Палитра' },
  { value: 'layers', label: 'Слои' },
];

/** Левая панель — абсолютная, прилипшая к левому краю: «Палитра» и «Слои». */
export function LeftPanel({
  width,
  shown,
  visible,
  showEditorPanels,
  resizing,
  leftTab,
  setLeftTab,
  setVisible,
  onResizeStart,
  onResizeKey,
}: LeftPanelProps) {
  const togglePanel = (next: boolean) => {
    setVisible(next);
    requestAnimationFrame(() =>
      document.getElementById(next ? 'left-panel-collapse' : 'left-panel-expand')?.focus(),
    );
  };
  const tabLabel = leftTab === 'palette' ? 'Палитра' : 'Слои';

  return (
    <div
      role={shown ? 'complementary' : undefined}
      aria-label={shown ? 'Палитра и слои' : undefined}
      // Лежит поверх холста — «вписать» не уводит схему под неё (canvas/lib/visibleArea).
      data-canvas-overlay="left"
      style={{ width: 'var(--ws-left-w)' }}
      className={`absolute left-0 top-0 bottom-0 z-panel border-r border-border bg-card dark:bg-card/80 backdrop-blur-md ease-in-out ${
        resizing ? 'transition-none' : 'transition-transform duration-300'
      } ${shown ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div inert={!shown} className="h-full w-full flex flex-col">
        {/* Вкладки левой панели: Палитра / Слои */}
        {/* «Свернуть» — в заголовке панели, рядом с вкладками. Раньше это была стрелка «<» на
            середине высоты холста, поверх схемы, и читалась как перелистывание (#18 п. 3). */}
        <div className="shrink-0 border-b px-2 py-1.5 flex items-center gap-1">
          <Tabs
            id="left"
            aria-label="Левая панель"
            value={leftTab}
            onValueChange={setLeftTab}
            items={LEFT_TAB_ITEMS}
            stretch
            className="flex-1 min-w-0"
          />
          <IconButton
            id="left-panel-collapse"
            icon={PanelLeftClose}
            label="Свернуть левую панель"
            tabIndex={shown ? 0 : -1}
            onClick={() => togglePanel(false)}
          />
        </div>
        <div {...tabPanelProps('left', leftTab)} className="flex-1 overflow-y-auto">
          {leftTab === 'palette' ? <Palette /> : <LayersPanel />}
        </div>
      </div>

      {/* Кнопка РАЗВЕРНУТЬ левую панель (висит снаружи) — с подписью: одна иконка в углу
          была незаметна. aria-hidden + tabIndex={-1}, когда кнопка скрыта: `opacity-0
          pointer-events-none` убирает её только от мыши, из порядка Tab — нет. */}
      <button
        id="left-panel-expand"
        type="button"
        onClick={() => togglePanel(true)}
        aria-label={`Развернуть левую панель: ${tabLabel}`}
        title="Развернуть левую панель"
        aria-hidden={visible || !showEditorPanels}
        tabIndex={!visible && showEditorPanels ? 0 : -1}
        className={`absolute top-4 left-full flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium bg-card border border-border rounded-r-md text-muted-foreground hover:bg-accent hover:text-foreground shadow-xl transition-opacity ${
          !visible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PanelLeft size={16} />
        {tabLabel}
      </button>

      {shown && (
        <ResizeHandle
          side="left"
          label="Ширина левой панели"
          value={width}
          min={LEFT_COLLAPSE}
          max={LEFT_MAX}
          onPointerDown={onResizeStart}
          onKeyDown={onResizeKey}
        />
      )}
    </div>
  );
}
