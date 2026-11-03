"use client";

import React from "react";
import {ChevronRight, PanelRight} from "lucide-react";
import {RIGHT_COLLAPSE, RIGHT_MAX} from "./lib/workspaceLayout";
import {ResizeHandle} from "./ResizeHandle";
import {SelectionProperties} from "./SelectionProperties";

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
  width, shown, visible, showEditorPanels, resizing, setVisible, onResizeStart, onResizeKey,
}: RightPanelProps) {
  return (
    <aside
      style={{width: "var(--ws-right-w)"}}
      className={`absolute right-0 top-0 bottom-0 z-panel border-l border-border bg-card dark:bg-card/80 backdrop-blur-md ease-in-out ${
        resizing ? 'transition-none' : 'transition-transform duration-300'
      } ${
        shown ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="h-full w-full overflow-y-auto">
        <SelectionProperties />
      </div>

      {/* Кнопка СВЕРНУТЬ правую панель */}
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Свернуть панель свойств"
        title="Свернуть панель свойств"
        aria-hidden={!shown}
        tabIndex={shown ? 0 : -1}
        className={`absolute top-[50%] -left-8 p-1 text-muted-foreground hover:text-foreground transition-opacity ${
          shown ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight size={24} />
      </button>

      {/* Кнопка РАЗВЕРНУТЬ правую панель */}
      <button
        type="button"
        onClick={() => setVisible(true)}
        aria-label="Развернуть панель свойств"
        title="Развернуть панель свойств"
        aria-hidden={visible || !showEditorPanels}
        tabIndex={!visible && showEditorPanels ? 0 : -1}
        className={`absolute top-4 -left-12 p-2 bg-card border border-border rounded-l-md text-muted-foreground hover:bg-accent shadow-xl transition-opacity ${
          !visible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PanelRight size={18} />
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
    </aside>
  );
}
