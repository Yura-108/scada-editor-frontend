"use client";

import React from "react";
import {ChevronLeft, PanelLeft} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {LayersPanel} from "@/components/editor/LayersPanel";
import Palette from "@/components/editor/Palette";
import {handleTabListKey} from "@/lib/editor/tabListKeys";
import {LEFT_COLLAPSE, LEFT_MAX, LEFT_TABS, type LeftTabType} from "./lib/workspaceLayout";
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

/** Левая панель — абсолютная, прилипшая к левому краю: «Палитра» и «Слои». */
export function LeftPanel({
  width, shown, visible, showEditorPanels, resizing, leftTab, setLeftTab, setVisible, onResizeStart, onResizeKey,
}: LeftPanelProps) {
  // Вкладки — настоящие вкладки: role="tablist"/"tab"/"tabpanel", aria-selected и
  // roving tabindex (одна остановка Tab на группу, дальше стрелками). Раньше это
  // был просто набор кнопок: скринридер не сообщал ни о группе, ни о том, какая
  // вкладка активна.
  const leftTabButton = (tab: LeftTabType, title: string) => (
    <button
      id={`left-tab-${tab}`}
      role="tab"
      type="button"
      aria-selected={leftTab === tab}
      aria-controls="left-panel-content"
      tabIndex={leftTab === tab ? 0 : -1}
      onClick={() => setLeftTab(tab)}
      onKeyDown={(e) => handleTabListKey(e, LEFT_TABS, leftTab, setLeftTab)}
      className={cn(
        "flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
        leftTab === tab
          ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 border-b-2 border-transparent",
      )}
    >
      {title}
    </button>
  );

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
        <div
          role="tablist"
          aria-label="Левая панель"
          className="flex h-11 shrink-0 border-b border-neutral-200 dark:border-neutral-800"
        >
          {leftTabButton("palette", "Палитра")}
          {leftTabButton("layers", "Слои")}
        </div>
        <div
          id="left-panel-content"
          role="tabpanel"
          aria-labelledby={`left-tab-${leftTab}`}
          className="flex-1 overflow-y-auto"
        >
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
