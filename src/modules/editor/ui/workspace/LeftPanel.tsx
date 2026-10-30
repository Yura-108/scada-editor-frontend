"use client";

import React from "react";
import {ChevronLeft, PanelLeft} from "lucide-react";
import {Tabs, tabPanelProps, type TabItem} from "@/shared/ui/Tabs";
import {LayersPanel} from "../layers-panel/LayersPanel";
import Palette from "../palette/Palette";
import {LEFT_COLLAPSE, LEFT_MAX, type LeftTabType} from "./lib/workspaceLayout";
import {ResizeHandle} from "./ResizeHandle";

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
  {value: "palette", label: "Палитра"},
  {value: "layers", label: "Слои"},
];

/** Левая панель — абсолютная, прилипшая к левому краю: «Палитра» и «Слои». */
export function LeftPanel({
  width, shown, visible, showEditorPanels, resizing, leftTab, setLeftTab, setVisible, onResizeStart, onResizeKey,
}: LeftPanelProps) {
  return (
    <aside
      style={{width: "var(--ws-left-w)"}}
      className={`absolute left-0 top-0 bottom-0 z-panel border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md ease-in-out ${
        resizing ? 'transition-none' : 'transition-transform duration-300'
      } ${
        shown ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="h-full w-full flex flex-col">
        {/* Вкладки левой панели: Палитра / Слои */}
        <div className="shrink-0 border-b px-2 py-1.5">
          <Tabs id="left" aria-label="Левая панель" value={leftTab} onValueChange={setLeftTab} items={LEFT_TAB_ITEMS} stretch />
        </div>
        <div {...tabPanelProps("left", leftTab)} className="flex-1 overflow-y-auto">
          {leftTab === "palette" ? <Palette /> : <LayersPanel />}
        </div>
      </div>

      {/* Кнопка СВЕРНУТЬ левую панель.
          aria-hidden + tabIndex={-1}, когда кнопка скрыта: `opacity-0
          pointer-events-none` убирает её только от мыши, из порядка Tab —
          нет, и клавиатура упиралась в невидимые кнопки. */}
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Свернуть левую панель"
        title="Свернуть левую панель"
        aria-hidden={!shown}
        tabIndex={shown ? 0 : -1}
        className={`absolute top-[50%] -right-8 p-2 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-opacity ${
          shown ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft size={24} />
      </button>

      {/* Кнопка РАЗВЕРНУТЬ левую панель (висит снаружи) */}
      <button
        type="button"
        onClick={() => setVisible(true)}
        aria-label="Развернуть левую панель"
        title="Развернуть левую панель"
        aria-hidden={visible || !showEditorPanels}
        tabIndex={!visible && showEditorPanels ? 0 : -1}
        className={`absolute top-4 -right-12 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-r-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-xl transition-opacity ${
          !visible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PanelLeft size={20} />
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
    </aside>
  );
}
