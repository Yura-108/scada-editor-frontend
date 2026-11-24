import React, {useEffect, useMemo, useRef, useState, type RefObject} from "react";
import {DiagramElement} from "@/core/scene";
import type {LayerRowData} from "./useLayerTree";

/**
 * Клавиатура панели слоёв: одна точка входа по Tab (roving tabindex), стрелки по строкам,
 * раскрытие и свёртка, Enter/пробел — выделить, F2 — войти в группу; перенос фокуса после
 * навигации и прокрутка к строке выделенного.
 */
export function useLayerKeyboard({treeRef, renderedRange, scrollToRow, visibleRows, selectedIds, toggleCollapsed, handleSelect, enterGroup}: {
  treeRef: RefObject<HTMLDivElement | null>;
  /**
   * Какие строки сейчас в разметке («первая-последняя»). Список виртуальный: строки вне
   * видимой области в DOM нет, и фокус на неё можно перенести только после прокрутки.
   */
  renderedRange: string;
  /** Прокрутить список так, чтобы строка с этим номером была видна. */
  scrollToRow: (index: number) => void;
  visibleRows: LayerRowData[];
  selectedIds: string[];
  toggleCollapsed: (key: string) => void;
  handleSelect: (key: string, additive: boolean) => void;
  enterGroup: (key: string) => void;
}) {
  // Roving tabindex: у дерева ровно одна точка входа по Tab, дальше — стрелками.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const shouldFocusRef = useRef(false);

  // Активная строка могла исчезнуть (удаление, undo, свёртывание родителя).
  const currentKey =
    activeKey && visibleRows.some(r => r.el.key === activeKey)
      ? activeKey
      : (visibleRows[0]?.el.key ?? null);

  // Фокус переносим только после навигации с клавиатуры — иначе панель воровала бы
  // фокус при любой перерисовке дерева.
  // Строки может ещё не быть в разметке (список виртуальный): флаг снимается, только когда
  // фокус действительно перенесён, а эффект повторяется на смену набора строк в разметке.
  useEffect(() => {
    if (!shouldFocusRef.current || !currentKey) return;
    const row = treeRef.current?.querySelector<HTMLElement>(`[data-layer-key="${CSS.escape(currentKey)}"]`);
    if (!row) return;
    shouldFocusRef.current = false;
    row.focus();
  }, [currentKey, renderedRange, treeRef]);

  // Элемент, за которым следует дерево: последний выделенный. `selectMultiple`
  // дописывает свежий ключ в конец, а выделение с холста кладёт единственный.
  const selectedKey = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;

  // Номер строки выделенного в дереве; −1 — строки нет (свёрнут предок, служебный элемент).
  const selectedRowIndex = useMemo(
    () => (selectedKey ? visibleRows.findIndex(r => r.el.key === selectedKey) : -1),
    [selectedKey, visibleRows],
  );
  const selectedRowVisible = selectedRowIndex >= 0;

  // Свежие номер и прокрутка — через ссылку: эффект ниже не должен срабатывать на их смену.
  const scrollTargetRef = useRef({selectedRowIndex, scrollToRow});
  useEffect(() => {
    scrollTargetRef.current = {selectedRowIndex, scrollToRow};
  });

  // Прокрутка к строке выделенного. Зависимость — флаг «строка есть в дереве», а не сам
  // `visibleRows` или номер строки: те меняются на каждую правку схемы, и список дёргался бы
  // на каждом кадре перетаскивания фигуры по холсту.
  // Прокручивает сам список, а не `scrollIntoView` у строки: в виртуальном списке строки вне
  // видимой области в разметке нет. Внешний скролл-контейнер (обёртка <aside> в WorkSpace)
  // при этом не двигается — как и раньше с `block: "nearest"`.
  useEffect(() => {
    if (!selectedKey || !selectedRowVisible) return;
    const {selectedRowIndex: index, scrollToRow: scroll} = scrollTargetRef.current;
    if (index >= 0) scroll(index);
  }, [selectedKey, selectedRowVisible]);

  const moveFocus = (delta: number) => {
    const idx = visibleRows.findIndex(r => r.el.key === currentKey);
    const next = visibleRows[Math.min(visibleRows.length - 1, Math.max(0, idx + delta))];
    // На краю списка ключ не меняется — иначе взведённый флаг «перенести фокус»
    // остался бы висеть и сработал бы на следующей перерисовке дерева.
    if (!next || next.el.key === currentKey) return;
    shouldFocusRef.current = true;
    scrollToRow(Math.min(visibleRows.length - 1, Math.max(0, idx + delta)));
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

  return {currentKey, setActiveKey, handleKeyDown};
}
