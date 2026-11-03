"use client";

import React from "react";
import {ChevronDown, ChevronRight} from "lucide-react";
import {DiagramElement} from "@/core/scene";
import {cn} from "@/shared/lib/cn";
import {layerIcon} from "./layerIcons";

/** Строка дерева слоёв: treeitem с уровнем и состоянием, стрелка свёртки, иконка, подпись. */
export function LayerRow({el, depth, isComposition, collapsed, selectedIds, currentKey, onClick, onDoubleClick, onKeyDown, toggleCollapsed}: {
  el: DiagramElement;
  depth: number;
  isComposition: boolean;
  collapsed: Set<string>;
  selectedIds: string[];
  currentKey: string | null;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onKeyDown: (e: React.KeyboardEvent, el: DiagramElement, hasMembers: boolean, isCollapsed: boolean) => void;
  toggleCollapsed: (key: string) => void;
}) {
  const isContainer = el.type === "group";
  const memberKeys = isContainer ? [...(el.composition ?? []), ...el.children] : [];
  const hasMembers = memberKeys.length > 0;
  const isCollapsed = collapsed.has(el.key);
  const isSelected = selectedIds.includes(el.key);

  const title = el.label || el.type;
  const icon = layerIcon(el);

  return (
    <div
      data-layer-key={el.key}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isSelected}
      aria-expanded={hasMembers ? !isCollapsed : undefined}
      tabIndex={el.key === currentKey ? 0 : -1}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer select-none text-sm transition-colors",
        isSelected
          ? "bg-primary/20 text-primary"
          : "text-foreground hover:bg-accent",
        isComposition && "opacity-60",
      )}
      style={{paddingLeft: `${8 + depth * 14}px`}}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => onKeyDown(e, el, hasMembers, isCollapsed)}
      title={el.isComponent ? `${title} (компонент)` : isComposition ? `${title} (примитив компонента)` : title}
    >
      {hasMembers ? (
        // Стрелка — не отдельная остановка Tab: раскрытием управляют
        // ArrowLeft/ArrowRight на самой строке.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => { e.stopPropagation(); toggleCollapsed(el.key); }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
      ) : (
        <span className="w-[13px] shrink-0" />
      )}
      <span className={cn("shrink-0", el.isComponent ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="truncate">{title}</span>
    </div>
  );
}
