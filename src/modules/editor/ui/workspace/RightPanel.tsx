"use client";

import React from "react";
import {PanelRight, PanelRightClose} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
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
      // Лежит поверх холста — «вписать» не уводит схему под неё (canvas/lib/visibleArea).
      data-canvas-overlay="right"
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

      {/* Кнопка СВЕРНУТЬ — в правом верхнем углу самой панели, у её заголовка, а не стрелкой
          «>» на середине холста поверх схемы (#18 п. 3). */}
      <IconButton
        icon={PanelRightClose}
        label="Свернуть панель свойств"
        tabIndex={shown ? 0 : -1}
        className="absolute top-2.5 right-2.5 z-10"
        onClick={() => setVisible(false)}
      />

      {/* Кнопка РАЗВЕРНУТЬ правую панель */}
      <button
        type="button"
        onClick={() => setVisible(true)}
        aria-label="Развернуть панель свойств"
        title="Развернуть панель свойств"
        aria-hidden={visible || !showEditorPanels}
        tabIndex={!visible && showEditorPanels ? 0 : -1}
        className={`absolute top-4 right-full flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium bg-card border border-border rounded-l-md text-muted-foreground hover:bg-accent hover:text-foreground shadow-xl transition-opacity ${
          !visible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
    </aside>
  );
}
