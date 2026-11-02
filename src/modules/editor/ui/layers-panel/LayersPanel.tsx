"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import {ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown} from "lucide-react";
import {useEditorStore} from "../../model/editorStore";
import {DiagramElement} from "@/core/scene";
import {cn} from "@/shared/lib/cn";
import {IconButton} from "@/shared/ui/IconButton";
import {layerIcon} from "./layerIcons";
import {useLayerTree} from "./useLayerTree";

/**
 * Панель слоёв: дерево объектов сцены (группы/компоненты + члены children и composition).
 * Клик — выделение (Ctrl — добавить), двойной клик по группе — войти в неё.
 */
export function LayersPanel() {
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectMultiple = useEditorStore(s => s.selectMultiple);
  const enterGroup = useEditorStore(s => s.enterGroup);
  const revealElement = useEditorStore(s => s.revealElement);
  const ensureElementVisible = useEditorStore(s => s.ensureElementVisible);

  const {collapsed, toggleCollapsed, containerKeys, allCollapsed, toggleAll, visibleRows} = useLayerTree();

  const handleSelect = (key: string, additive: boolean) => {
    if (additive) {
      selectMultiple([...selectedIds.filter(id => id !== key), key]);
    } else {
      // Одиночный выбор ОТКРЫВАЕТ уровень элемента: содержимое неоткрытой группы на холсте
      // недоступно, и элемент оказался бы выделенным, но неподвижным. Одним действием, а не
      // «войти, затем выделить»: enterGroup чистит выделение.
      revealElement(key);
    }
    // Камеру двигаем ТОЛЬКО отсюда, а не из revealElement: при выделении на холсте или
    // Ctrl+A ехать некуда — человек и так смотрит на элемент.
    ensureElementVisible(key);
  };

  // Roving tabindex: у дерева ровно одна точка входа по Tab, дальше — стрелками.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const shouldFocusRef = useRef(false);

  // Активная строка могла исчезнуть (удаление, undo, свёртывание родителя).
  const currentKey =
    activeKey && visibleRows.some(r => r.el.key === activeKey)
      ? activeKey
      : (visibleRows[0]?.el.key ?? null);

  // Фокус переносим только после навигации с клавиатуры — иначе панель воровала бы
  // фокус при любой перерисовке дерева.
  useEffect(() => {
    if (!shouldFocusRef.current || !currentKey) return;
    shouldFocusRef.current = false;
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-layer-key="${CSS.escape(currentKey)}"]`)
      ?.focus();
  }, [currentKey]);

  // Элемент, за которым следует дерево: последний выделенный. `selectMultiple`
  // дописывает свежий ключ в конец, а выделение с холста кладёт единственный.
  const selectedKey = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;

  const selectedRowVisible = useMemo(
    () => !!selectedKey && visibleRows.some(r => r.el.key === selectedKey),
    [selectedKey, visibleRows],
  );

  // Прокрутка к строке выделенного. Зависимость — флаг «строка есть в дереве», а не сам
  // `visibleRows`: тот пересоздаётся на каждую правку схемы, и список дёргался бы на
  // каждом кадре перетаскивания фигуры по холсту.
  // `block: "nearest"` обязателен: слева два вложенных скролл-контейнера (обёртка <aside>
  // в WorkSpace тоже прокручиваемая), и "center" двигал бы заодно и внешний.
  useEffect(() => {
    if (!selectedKey || !selectedRowVisible) return;
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-layer-key="${CSS.escape(selectedKey)}"]`)
      ?.scrollIntoView({block: "nearest"});
  }, [selectedKey, selectedRowVisible]);

  const moveFocus = (delta: number) => {
    const idx = visibleRows.findIndex(r => r.el.key === currentKey);
    const next = visibleRows[Math.min(visibleRows.length - 1, Math.max(0, idx + delta))];
    // На краю списка ключ не меняется — иначе взведённый флаг «перенести фокус»
    // остался бы висеть и сработал бы на следующей перерисовке дерева.
    if (!next || next.el.key === currentKey) return;
    shouldFocusRef.current = true;
    setActiveKey(next.el.key);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    el: DiagramElement,
    hasMembers: boolean,
    isCollapsed: boolean,
  ) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "ArrowRight":
        // Стандартное поведение дерева: свёрнутый узел раскрыть, раскрытый — войти внутрь.
        e.preventDefault();
        if (hasMembers && isCollapsed) toggleCollapsed(el.key);
        else if (hasMembers) moveFocus(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (hasMembers && !isCollapsed) toggleCollapsed(el.key);
        else moveFocus(-1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        handleSelect(el.key, e.ctrlKey || e.metaKey || e.shiftKey);
        break;
      case "F2":
        // Аналог двойного клика — вход в группу.
        if (el.type === "group") {
          e.preventDefault();
          enterGroup(el.key);
        }
        break;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0 flex items-center justify-between gap-2">
        <h3
          id="layers-panel-heading"
          className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400"
        >
          Слои
        </h3>
        {containerKeys.length > 0 && (
          <IconButton
            icon={allCollapsed ? ChevronsUpDown : ChevronsDownUp}
            label={allCollapsed ? "Развернуть всё" : "Свернуть всё"}
            size="xs"
            onClick={toggleAll}
          />
        )}
      </div>
      <div
        ref={treeRef}
        role="tree"
        aria-labelledby="layers-panel-heading"
        aria-multiselectable
        className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-0.5"
      >
        {visibleRows.length === 0 ? (
          <div className="text-center text-neutral-500 text-sm py-8">Схема пуста</div>
        ) : (
          visibleRows.map(({el, depth, isComposition}) => {
            const isContainer = el.type === "group";
            const memberKeys = isContainer ? [...(el.composition ?? []), ...el.children] : [];
            const hasMembers = memberKeys.length > 0;
            const isCollapsed = collapsed.has(el.key);
            const isSelected = selectedIds.includes(el.key);

            const title = el.label || el.type;
            const icon = layerIcon(el);

            return (
              <div
                key={el.key}
                data-layer-key={el.key}
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={isSelected}
                aria-expanded={hasMembers ? !isCollapsed : undefined}
                tabIndex={el.key === currentKey ? 0 : -1}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer select-none text-sm transition-colors",
                  isSelected
                    ? "bg-blue-600/20 text-blue-700 dark:text-blue-300"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
                  isComposition && "opacity-60",
                )}
                style={{paddingLeft: `${8 + depth * 14}px`}}
                onClick={(e) => {
                  setActiveKey(el.key);
                  handleSelect(el.key, e.ctrlKey || e.metaKey || e.shiftKey);
                }}
                onDoubleClick={() => { if (isContainer) enterGroup(el.key); }}
                onKeyDown={(e) => handleKeyDown(e, el, hasMembers, isCollapsed)}
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
                <span className={cn("shrink-0", el.isComponent ? "text-indigo-500" : "text-neutral-400")}>{icon}</span>
                <span className="truncate">{title}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
