import React, {useEffect, useMemo, useRef, useState} from "react";
import {DiagramElement} from "@/core/scene";
import type {LayerRowData} from "./useLayerTree";

/**
 * Клавиатура панели слоёв: одна точка входа по Tab (roving tabindex), стрелки по строкам,
 * раскрытие и свёртка, Enter/пробел — выделить, F2 — войти в группу; перенос фокуса после
 * навигации и прокрутка к строке выделенного.
 */
export function useLayerKeyboard({visibleRows, selectedIds, toggleCollapsed, handleSelect, enterGroup}: {
  visibleRows: LayerRowData[];
  selectedIds: string[];
  toggleCollapsed: (key: string) => void;
  handleSelect: (key: string, additive: boolean) => void;
  enterGroup: (key: string) => void;
}) {
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

  return {treeRef, currentKey, setActiveKey, handleKeyDown};
}
