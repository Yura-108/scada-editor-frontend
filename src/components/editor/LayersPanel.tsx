"use client";

import React, {useMemo, useState} from "react";
import {ChevronDown, ChevronRight, Boxes, Folder, Square, Circle as CircleIcon, Minus, Type, CheckSquare, SlidersHorizontal, MousePointerClick, ToggleLeft, ChevronsUpDown, TextCursorInput, Spline, BarChart3} from "lucide-react";
import {useEditorStore} from "@/store/useEditorStore";
import {DiagramElement} from "@/types/editorElement.type";
import {cn} from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  rectangle: <Square size={13} />,
  circle: <CircleIcon size={13} />,
  line: <Minus size={13} />,
  polygon: <Spline size={13} />,
  text: <Type size={13} />,
  checkbox: <CheckSquare size={13} />,
  progress_bar: <BarChart3 size={13} />,
  button: <MousePointerClick size={13} />,
  toggle: <ToggleLeft size={13} />,
  slider: <SlidersHorizontal size={13} />,
  dropdown: <ChevronsUpDown size={13} />,
  input: <TextCursorInput size={13} />,
};

/**
 * Панель слоёв: дерево объектов сцены (группы/компоненты + члены children и composition).
 * Клик — выделение (Ctrl — добавить), двойной клик по группе — войти в неё.
 */
export function LayersPanel() {
  const elements = useEditorStore(s => s.elements);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const scene = useEditorStore(s => s.scene);
  const selectMultiple = useEditorStore(s => s.selectMultiple);
  const enterGroup = useEditorStore(s => s.enterGroup);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const byKey = useMemo(() => {
    const m = new Map<string, DiagramElement>();
    elements.forEach(el => m.set(el.key, el));
    return m;
  }, [elements]);

  const roots = useMemo(
    () => elements.filter(el => el.parentKey === String(scene?.id)),
    [elements, scene],
  );

  const toggleCollapsed = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelect = (key: string, additive: boolean) => {
    selectMultiple(additive ? [...selectedIds.filter(id => id !== key), key] : [key]);
  };

  const renderNode = (el: DiagramElement, depth: number, isComposition: boolean): React.ReactNode => {
    const isContainer = el.type === "group";
    // Порядок отрисовки на холсте: composition (низ) → children (верх).
    const memberKeys = isContainer ? [...(el.composition ?? []), ...el.children] : [];
    const hasMembers = memberKeys.length > 0;
    const isCollapsed = collapsed.has(el.key);
    const isSelected = selectedIds.includes(el.key);

    const title = el.label || el.type;
    const icon = isContainer
      ? (el.isComponent ? <Boxes size={13} /> : <Folder size={13} />)
      : (TYPE_ICONS[el.type] ?? <Square size={13} />);

    return (
      <React.Fragment key={el.key}>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer select-none text-sm transition-colors",
            isSelected
              ? "bg-blue-600/20 text-blue-700 dark:text-blue-300"
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
            isComposition && "opacity-60",
          )}
          style={{paddingLeft: `${8 + depth * 14}px`}}
          onClick={(e) => handleSelect(el.key, e.ctrlKey || e.metaKey || e.shiftKey)}
          onDoubleClick={() => { if (isContainer) enterGroup(el.key); }}
          title={el.isComponent ? `${title} (компонент)` : isComposition ? `${title} (примитив компонента)` : title}
        >
          {hasMembers ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapsed(el.key); }}
              className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          <span className={cn("shrink-0", el.isComponent ? "text-indigo-500" : "text-neutral-400")}>{icon}</span>
          <span className="truncate">{title}</span>
        </div>

        {hasMembers && !isCollapsed && memberKeys.map(k => {
          const member = byKey.get(k);
          if (!member) return null;
          return renderNode(member, depth + 1, (el.composition ?? []).includes(k));
        })}
      </React.Fragment>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Слои
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-0.5">
        {roots.length === 0 ? (
          <div className="text-center text-neutral-500 text-sm py-8">Сцена пуста</div>
        ) : (
          roots.map(el => renderNode(el, 0, false))
        )}
      </div>
    </div>
  );
}
