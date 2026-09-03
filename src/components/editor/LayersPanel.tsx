"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import {ChevronDown, ChevronRight, ChevronsDownUp, Boxes, Folder, Square, Circle as CircleIcon, Minus, Type, Radius, PenTool, CheckSquare, SlidersHorizontal, MousePointerClick, ToggleLeft, ChevronsUpDown, TextCursorInput, Spline, BarChart3} from "lucide-react";
import {useEditorStore} from "@/store/useEditorStore";
import {DiagramElement} from "@/types/editorElement.type";
import {cn} from "@/lib/utils";
import {sortByZIndex, sortKeysByZIndex} from "@/lib/editor/zOrder";
import {getElementIndex} from "@/lib/editor/elementIndex";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  rectangle: <Square size={13} />,
  circle: <CircleIcon size={13} />,
  arc: <Radius size={13} />,
  curve: <PenTool size={13} />,
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
  const revealElement = useEditorStore(s => s.revealElement);
  const ensureElementVisible = useEditorStore(s => s.ensureElementVisible);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Общий индекс схемы (кэширован по ссылке на массив) — та же карта, что у холста.
  // Нужен и для состава строк, и для подъёма по parentKey к предкам выделенного.
  const byKey = useMemo(() => getElementIndex(elements).byKey, [elements]);

  // Порядок строк обязан совпадать с порядком отрисовки холста — тот же zIndex
  // со стабильной сортировкой (при равных слоях остаётся порядок массива).
  // `visible: false` — служебный элемент (данные листа), фигурой не является:
  // в дереве слоёв это была бы пустая строка. Так же он отфильтрован в маркизе
  // и во «вписать схему».
  const roots = useMemo(
    () => sortByZIndex(elements.filter(
      el => el.parentKey === String(scene?.id) && el.visible !== false,
    )),
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

  /**
   * Ключи всех контейнеров схемы — по `elements`, а НЕ по видимым строкам.
   *
   * Группа внутри уже свёрнутой в `visibleRows` отсутствует, и «свернуть всё» оставило
   * бы её раскрытой — она развернулась бы сама, стоит открыть родителя.
   */
  const containerKeys = useMemo(
    () => elements
      .filter(el => el.type === "group" && [...(el.composition ?? []), ...el.children].length > 0)
      .map(el => el.key),
    [elements],
  );

  const allCollapsed = containerKeys.length > 0 && containerKeys.every(k => collapsed.has(k));

  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(containerKeys));

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

  /**
   * Плоский список видимых строк в порядке отрисовки.
   *
   * Дерево и раньше рендерилось плоско (вложенность передаётся только отступом
   * через paddingLeft), поэтому развернуть рекурсию в массив — не изменение
   * разметки, а необходимое условие для клавиатуры: по нему считаются
   * «следующая/предыдущая строка» для стрелок и aria-level.
   */
  const visibleRows = useMemo(() => {
    const rows: {el: DiagramElement; depth: number; isComposition: boolean}[] = [];

    const walk = (el: DiagramElement, depth: number, isComposition: boolean) => {
      rows.push({el, depth, isComposition});
      if (el.type !== "group" || collapsed.has(el.key)) return;
      // Порядок отрисовки на холсте: по zIndex среди соседей; при равных слоях —
      // порядок конкатенации composition (низ) → children (верх).
      const memberKeys = sortKeysByZIndex([...(el.composition ?? []), ...el.children], byKey);
      memberKeys.forEach(k => {
        const member = byKey[k];
        if (member) walk(member, depth + 1, (el.composition ?? []).includes(k));
      });
    };

    roots.forEach(el => walk(el, 0, false));
    return rows;
  }, [byKey, collapsed, roots]);

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

  /**
   * Раскрываем свёрнутых предков выделенного — иначе его строки в дереве просто нет,
   * и прокручивать было бы не к чему.
   *
   * Именно подписка на стор, а не эффект по `selectedIds`: выделение приходит ИЗВНЕ
   * панели (холст, хоткеи, вход в группу), и это ровно тот «внешний источник», ради
   * которого подписки и существуют — `setState` в теле эффекта дал бы каскадный
   * ре-рендер на каждую смену выделения.
   *
   * Раскрытие остаётся в `collapsed` (а не выводится при рендере) намеренно: иначе
   * ветку с выделенным элементом нельзя было бы свернуть стрелкой — вывод тут же
   * раскрывал бы её обратно.
   */
  useEffect(() => useEditorStore.subscribe((state, prev) => {
    const key = state.selectedIds[state.selectedIds.length - 1];
    if (!key || key === prev.selectedIds[prev.selectedIds.length - 1]) return;

    const byKeyNow = getElementIndex(state.elements).byKey;
    const ancestors: string[] = [];
    for (let k = byKeyNow[key]?.parentKey; k && byKeyNow[k]; k = byKeyNow[k].parentKey) {
      ancestors.push(k);
    }
    if (!ancestors.length) return;

    setCollapsed(prevSet => {
      // Прежний Set по ссылке, если раскрывать нечего: новый объект здесь означал бы
      // ре-рендер дерева на каждое изменение стора.
      if (!ancestors.some(k => prevSet.has(k))) return prevSet;
      const next = new Set(prevSet);
      ancestors.forEach(k => next.delete(k));
      return next;
    });
  }), []);

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
          <button
            type="button"
            onClick={toggleAll}
            title={allCollapsed ? "Развернуть всё" : "Свернуть всё"}
            aria-label={allCollapsed ? "Развернуть всё" : "Свернуть всё"}
            className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            {allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
          </button>
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
            const icon = isContainer
              ? (el.isComponent ? <Boxes size={13} /> : <Folder size={13} />)
              : (TYPE_ICONS[el.type] ?? <Square size={13} />);

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
            );
          })
        )}
      </div>
    </div>
  );
}
