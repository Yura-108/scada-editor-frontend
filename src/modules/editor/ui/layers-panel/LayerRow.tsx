"use client";

import React from "react";
import {ChevronDown, ChevronRight} from "lucide-react";
import {DiagramElement} from "@/core/scene";
import {cn} from "@/shared/lib/cn";
import {layerIcon} from "./layerIcons";
import {elementDisplayName} from "../../lib/elementNames";

/**
 * Обработчики строки. Объект один на всю панель и по ссылке не меняется — иначе мемоизация
 * строк не срабатывала бы ни разу (см. `LayersPanel`).
 */
export interface LayerRowActions {
  click: (el: DiagramElement, e: React.MouseEvent) => void;
  doubleClick: (el: DiagramElement) => void;
  keyDown: (e: React.KeyboardEvent, el: DiagramElement, hasMembers: boolean, isCollapsed: boolean) => void;
  toggleCollapsed: (key: string) => void;
}

interface LayerRowProps {
  el: DiagramElement;
  depth: number;
  isComposition: boolean;
  isCollapsed: boolean;
  isSelected: boolean;
  /** Строка — точка входа в дерево по Tab (roving tabindex). */
  isCurrent: boolean;
  actions: LayerRowActions;
}

/**
 * Строка дерева слоёв: treeitem с уровнем и состоянием, стрелка свёртки, иконка, подпись.
 *
 * Мемоизирована, а всё изменчивое приходит булевыми флагами: пока строка получала весь
 * `selectedIds`, множество свёрнутых и новые замыкания, любая правка схемы и любая смена
 * выделения перерисовывали дерево целиком — на схеме в тысячи элементов это тысячи строк на
 * каждое действие. Теперь перерисовываются только строки, у которых что-то изменилось.
 */
export const LayerRow = React.memo(function LayerRow({
  el, depth, isComposition, isCollapsed, isSelected, isCurrent, actions,
}: LayerRowProps) {
  const isContainer = el.type === "group";
  const hasMembers = isContainer && (el.composition?.length ?? 0) + el.children.length > 0;

  const title = elementDisplayName(el);
  const icon = layerIcon(el);

  return (
    <div
      data-layer-key={el.key}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isSelected}
      aria-expanded={hasMembers ? !isCollapsed : undefined}
      tabIndex={isCurrent ? 0 : -1}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer select-none text-sm transition-colors",
        isSelected
          ? "bg-primary/20 text-primary"
          : "text-foreground hover:bg-accent",
        isComposition && "opacity-60",
      )}
      style={{paddingLeft: `${8 + depth * 14}px`}}
      onClick={(e) => actions.click(el, e)}
      onDoubleClick={() => actions.doubleClick(el)}
      onKeyDown={(e) => actions.keyDown(e, el, hasMembers, isCollapsed)}
      title={el.isComponent ? `${title} (компонент)` : isComposition ? `${title} (примитив компонента)` : title}
    >
      {hasMembers ? (
        // Стрелка — не отдельная остановка Tab: раскрытием управляют
        // ArrowLeft/ArrowRight на самой строке.
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => { e.stopPropagation(); actions.toggleCollapsed(el.key); }}
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
});
