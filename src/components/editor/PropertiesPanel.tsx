"use client";

import React, {useState, useMemo, useEffect} from "react";
import {DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent} from "@dnd-kit/core";
import {SortableContext, arrayMove, rectSortingStrategy, useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {cn} from "@/lib/utils";
import {DiagramElement, ElementType, PropertySchema, TableCellData} from "@/types/editorElement.type";
import {PropertyCreateDto} from "@/types/tags.types";
import {elementPropertyMap, basePropertySchema} from "@/constants/propertiesPanel";
import {Plus, AlertTriangle, Trash2, Boxes, GripVertical} from "lucide-react";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {StateSelect} from "@/components/ui/StateSelect";
import {openInputModal} from "@/components/ui/OpenInputModal";
import {ColorField} from "@/components/ui/ColorField";
import {openScriptEditorModal} from "@/components/ui/OpenScriptEditorModal";
import {useEditorStore} from "@/store/useEditorStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {createUuid} from "@/lib/createUuid";
import {BindingsTab} from "@/components/editor/bindings/BindingsTab";
import {RowBindingsTab} from "@/components/editor/bindings/RowBindingsTab";
import {EventsTab} from "@/components/editor/events/EventsTab";
import {ChooseObjectPropertyModal} from "@/components/editor/bindings/OpenChooseObjectPropertyModal";
import {collectTagScope, hasSavedProperty} from "@/lib/runtime/bindingScope";
import {buildDirectBinding} from "@/lib/runtime/directBinding";
import {cellRuntimeKey, getCellData, mergeCellPatch} from "@/lib/editor/tableCells";

interface PropertiesPanelProps {
  element: DiagramElement | null;
}

/**
 * «Таблетка» свойства в общем списке: ручка перетаскивания (attributes/listeners
 * dnd-kit) висит ТОЛЬКО на иконке — остальная часть таблетки сохраняет исходный
 * onClick открытия модалки редактирования, drag и клик не конфликтуют.
 */
function SortablePropertyPill({property, onClick}: {property: PropertyCreateDto; onClick: () => void}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: property.id});
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1.5",
        "text-xs font-medium rounded-full",
        "bg-indigo-950/60 text-indigo-300",
        "border border-indigo-800/40",
        "hover:bg-indigo-900/70 transition-colors cursor-pointer"
      )}
    >
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-indigo-400/70 hover:text-indigo-200 -ml-1"
        title="Перетащить для изменения порядка"
      >
        <GripVertical size={12} />
      </span>
      {property.name || property.property_type || "Свойство"}
      {property.tag_id ? ` • #${property.tag_id}` : ""}
    </span>
  );
}

type TabType = "visual" | "states" | "properties" | "scripts" | "bindings" | "events" | "rowBindings";

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({element}) => {
  const [activeTab, setActiveTab] = useState<TabType>("visual");
  // Точечные селекторы: подписка на весь стор ре-рендерила панель на каждый тик пана/зума.
  const updateElement = useEditorStore(s => s.updateElement);
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);
  const addComponentStateToSubtree = useEditorStore(s => s.addComponentStateToSubtree);
  const removeComponentStateFromSubtree = useEditorStore(s => s.removeComponentStateFromSubtree);
  const setCurrentComponentStateId = useEditorStore(s => s.setCurrentComponentStateId);
  const currentComponentStateByElementKey = useEditorStore(s => s.currentComponentStateByElementKey);
  const selectedTableCell = useEditorStore(s => s.selectedTableCell);
  const clearTableCellSelection = useEditorStore(s => s.clearTableCellSelection);
  const addBinding = useEditorStore(s => s.addBinding);
  const removeBinding = useEditorStore(s => s.removeBinding);
  const [cellPickerOpen, setCellPickerOpen] = useState(false);
  // База каналов подгружена, если в дереве устройств есть узлы (глобальный стор,
  // наполняется при заходе в раздел «База каналов»). Без неё не из чего выбрать тег.
  const isChannelBaseLoaded = useDeviceStore(s => s.nodes.length > 0);

  const currentComponentStateId = element
    ? (currentComponentStateByElementKey[element.key] ?? element.states.find(s => s.isDefault)?.id ?? element.states[0]?.id)
    : undefined;

  const renderedElement = useMemo(() => element ? getRenderedElement(element) : null, [element, currentComponentStateId]);
  const renderedElementValues = useMemo(
    () => renderedElement ? (renderedElement as unknown as Record<string, unknown>) : {},
    [renderedElement]
  );
  const editProperty = useEditorStore(s => s.editProperty);
  const elementProperties = useMemo(() => element?.properties ?? [], [element?.properties]);
  // Локальный порядок во время/сразу после драга — визуальная обратная связь до
  // того, как все editProperty-запросы вернутся и стор пересчитает elementProperties.
  // Сброс при смене элемента — во время рендера (React-паттерн "adjusting state
  // during render"), не в эффекте: избегает лишнего ре-рендера/cascading setState.
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);
  const [localOrderElementKey, setLocalOrderElementKey] = useState(element?.key);
  if (element?.key !== localOrderElementKey) {
    setLocalOrderElementKey(element?.key);
    setLocalOrder(null);
  }
  const sortedProperties = useMemo(() => {
    const base = [...elementProperties].sort((a, b) =>
      (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
    );
    if (!localOrder) return base;
    const byId = new Map(base.map(p => [p.id, p] as const));
    const reordered = localOrder.map(id => byId.get(id)).filter((p): p is PropertyCreateDto => Boolean(p));
    for (const p of base) if (!localOrder.includes(p.id)) reordered.push(p);
    return reordered;
  }, [elementProperties, localOrder]);
  const dndSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}));
  const handlePropertyDragEnd = async (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id) return;
    const ids = sortedProperties.map(p => p.id);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedIds = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder(reorderedIds);

    const byId = new Map(sortedProperties.map(p => [p.id, p] as const));
    await Promise.all(
      reorderedIds.map((id, index) => {
        const prop = byId.get(id);
        if (!prop || prop.position === index) return null;
        const {id: propId, ...payload} = prop;
        return editProperty(propId, {...payload, position: index});
      })
    );
  };
  const elementScripts = useMemo(() => element?.scripts ?? [], [element?.scripts]);

  const schema: PropertySchema[] = useMemo(() => element ? [
    ...basePropertySchema,
    ...(elementPropertyMap[element.type as ElementType] || []),
  ] : [], [element?.type, element]);

  // У таблицы нет вкладки «Свойства» (её роль выполняет «Строки» — привязки по рядам).
  // Если выбор переключился на таблицу, пока была открыта эта вкладка — уводим на «Визуал».
  useEffect(() => {
    if (element?.type === "table" && activeTab === "properties") {
      setActiveTab("visual");
    }
  }, [element?.key, element?.type]);

  if (!element) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
        Выберите элемент для редактирования свойств
      </div>
    );
  }

  const baseInputClasses = cn(
    "w-full bg-white/80 dark:bg-neutral-900/80 border border-gray-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm",
    "text-gray-900 dark:text-neutral-100 placeholder:text-gray-500 dark:placeholder:text-neutral-600",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
    "transition-all duration-200 hover:border-gray-400 dark:hover:border-neutral-600"
  );

  const baseAddButtonClasses = cn(
    "flex items-center gap-2 py-2",
    "hover:underline hover:scale-105",
    "rounded-xl",
    "text-sm font-medium",
    "text-gray-800 dark:text-gray-200",
    "transition-all duration-200",
    "active:scale-95"
  );

  const tabButtonClasses = (isActive: boolean) => cn(
    "flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200",
    "border border-gray-300 dark:border-neutral-700",
    isActive
      ? "bg-blue-600/40 text-blue-200 border-blue-500/50 dark:bg-blue-600/70 dark:text-blue-100 dark:border-blue-500/70"
      : "bg-gray-100/40 text-gray-600 hover:bg-gray-200/60 hover:text-gray-500 dark:bg-neutral-900/40 dark:text-neutral-400 hover:dark:bg-neutral-800/60 hover:dark:text-neutral-300"
  );

  const addComponentState = (value: string) => {
    const createdStateId = addComponentStateToSubtree(element.key, value);
    if (createdStateId) {
      setCurrentComponentStateId(element.key, createdStateId);
    }
  }

  const removeComponentState = (stateName: string) => {
    if (!window.confirm(`Удалить состояние «${stateName}»? Его визуальные настройки будут потеряны.`)) {
      return;
    }
    removeComponentStateFromSubtree(element.key, stateName);
  }

  const handleAddScript = () => {
    if (!element) return;
    openScriptEditorModal({
      title: "Добавление скрипта",
      description: "Напишите Java-код для обработки событий компонента",
      onConfirm: (name, content) => {
        const newScript = { id: createUuid(), name, content };
        updateElement(element.key, {
          scripts: [...(element.scripts || []), newScript]
        });
      }
    });
  }

  const getNumberValue = (rawValue: unknown, fallback = 0) => {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // Добавлять свойства можно только сохранённому элементу (у него есть id на
  // сервере — свойства создаются серверным роутом по component_id) и при
  // загруженной базе каналов (дерево устройств нужно, чтобы выбрать тег).
  const isElementSaved = element.id != null;
  const canAddProperty = isElementSaved && isChannelBaseLoaded;
  const addPropertyHint = !isElementSaved && !isChannelBaseLoaded
    ? "Сначала сохраните сцену и откройте раздел «База каналов»: свойства добавляются только сохранённым элементам, а для выбора тега нужно загруженное дерево устройств."
    : !isElementSaved
      ? "Сначала сохраните сцену — свойство можно добавить только сохранённому элементу (он ещё не создан на сервере)."
      : "Откройте раздел «База каналов» и загрузите проект — без дерева устройств не из чего выбрать тег.";

  // Сфокусированная ячейка таблицы (панель свойств показывает cell-блок только пока
  // фокус принадлежит ИМЕННО этому элементу — переживает переключение вкладок).
  const cellFocus = element.type === "table" && selectedTableCell?.elementKey === element.key
    ? selectedTableCell
    : null;
  const cellsMap = renderedElementValues.cells as Record<string, TableCellData> | undefined;
  const cellData = cellFocus ? getCellData(cellsMap, cellFocus.row, cellFocus.col) : undefined;
  const cellTargetKey = cellFocus ? cellRuntimeKey(cellFocus.row, cellFocus.col) : null;
  const cellBinding = cellTargetKey
    ? (element.bindings ?? []).find(b => b.direct && b.directTarget === cellTargetKey)
    : undefined;
  const cellBindingRef = cellBinding?.propertyRefs?.[0];
  const canBindCell = hasSavedProperty(element.properties);

  const patchCell = (patch: Partial<TableCellData>) => {
    if (!cellFocus) return;
    updateElementVisual(element.key, {
      cells: mergeCellPatch(cellsMap, cellFocus.row, cellFocus.col, patch),
    });
  };

  const handleSelectChange = (key: string, value: string) => {
    // Смена ориентации прогресс-бара меняет местами w/h, чтобы вертикальный бар был
    // реально узким и высоким, а не оставался в приплюснутой коробке (ключ orientation
    // есть только у прогресс-бара). w/h — позиционные поля, рамки групп пересчитаются.
    if (key === "orientation" && value !== renderedElementValues.orientation) {
      const curW = Number(renderedElementValues.w) || 0;
      const curH = Number(renderedElementValues.h) || 0;
      updateElementVisual(element.key, { orientation: value as "horizontal" | "vertical", w: curH, h: curW });
      return;
    }
    updateElementVisual(element.key, { [key]: value });
  };

  const renderPropertyInput = (property: PropertySchema, index: number) => {
    const rawValue = renderedElementValues[property.key];
    const uniqueKey = `${element.id}-${property.key}-${index}`;

    const textValue = typeof rawValue === "string"
      ? rawValue
      : (typeof property.defaultValue === "string" ? property.defaultValue : "");

    const numberValue = getNumberValue(
      rawValue,
      typeof property.defaultValue === "number" ? property.defaultValue : 0
    );

    const colorValue = typeof rawValue === "string" && rawValue
      ? rawValue
      : (typeof property.defaultValue === "string" && property.defaultValue
        ? property.defaultValue
        : "#ffffff");

    const selectValue = typeof rawValue === "string"
      ? rawValue
      : (typeof property.defaultValue === "string" ? property.defaultValue : "");

    const booleanValue = typeof rawValue === "boolean"
      ? rawValue
      : Boolean(property.defaultValue);

    const label = (
      <label
        htmlFor={`prop-${property.key}`}
        className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
      >
        {property.label}
      </label>
    );

    switch (property.type) {
      case "text":
        return (
          <div key={uniqueKey} className="space-y-1.5">
            {label}
            <input
              id={`prop-${property.key}`}
              className={baseInputClasses}
              value={textValue}
              placeholder={property.placeholder || ""}
              onChange={(e) =>
                updateElementVisual(element.key, {[property.key]: e.target.value})
              }
            />
          </div>
        );

      case "number":
        return (
          <div key={uniqueKey} className="space-y-1.5">
            {label}
            <input
              id={`prop-${property.key}`}
              type="number"
              className={baseInputClasses}
              value={numberValue}
              min={property.min}
              max={property.max}
              step={property.step ?? 1}
              onChange={(e) =>
                updateElementVisual(element.key, {
                  [property.key]: Number(e.target.value) || 0,
                })
              }
            />
          </div>
        );

      case "color":
        return (
          <ColorField
            key={uniqueKey}
            id={`prop-${property.key}`}
            label={property.label}
            value={colorValue}
            onChange={(v) => updateElementVisual(element.key, {[property.key]: v})}
            inputClassName={baseInputClasses}
          />
        );

      case "select":
        return (
          <div key={uniqueKey} className="space-y-1.5">
            {label}
            <select
              id={`prop-${property.key}`}
              className={cn(baseInputClasses, "appearance-none pr-8")}
              value={selectValue}
              onChange={(e) => handleSelectChange(property.key, e.target.value)}
            >
              {property.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case "boolean":
        return (
          <div key={uniqueKey} className="flex items-center gap-2 py-1">
            <input
              id={`prop-${property.key}`}
              type="checkbox"
              checked={booleanValue}
              onChange={(e) =>
                updateElementVisual(element.key, {[property.key]: e.target.checked})
              }
              className={cn(
                "w-4 h-4 rounded border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800",
                "text-blue-500 focus:ring-blue-500/40 focus:ring-offset-white dark:focus:ring-offset-neutral-950",
                "checked:bg-blue-600 checked:border-blue-600",
                "transition-all duration-150"
              )}
            />
            <label
              htmlFor={`prop-${property.key}`}
              className="text-sm text-gray-800 dark:text-neutral-300 cursor-pointer select-none"
            >
              {property.label}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div key={element.key} className="h-full flex flex-col bg-white/70 dark:bg-neutral-950/70 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 pb-3 border-b border-gray-200 dark:border-neutral-800">
        <h3 className="text-base font-medium text-gray-900 dark:text-neutral-200 tracking-tight">
          {element.type.charAt(0).toUpperCase() + element.type.slice(1)} Properties
        </h3>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 font-mono">
          ID: {element.key.slice(0, 8)}...
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-neutral-800">
        <div className="grid grid-rows-2 grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab("visual")}
            className={tabButtonClasses(activeTab === "visual")}
          >
            Визуал
          </button>
          <button
            onClick={() => setActiveTab("states")}
            className={tabButtonClasses(activeTab === "states")}
          >
            Состояния
          </button>
          {element.type !== "table" && (
            <button
              onClick={() => setActiveTab("properties")}
              className={tabButtonClasses(activeTab === "properties")}
            >
              Свойства
            </button>
          )}
          <button
            onClick={() => setActiveTab("scripts")}
            className={tabButtonClasses(activeTab === "scripts")}
          >
            Скрипты
          </button>
          <button
            onClick={() => setActiveTab("bindings")}
            className={tabButtonClasses(activeTab === "bindings")}
          >
            Привязки
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={tabButtonClasses(activeTab === "events")}
          >
            События
          </button>
          {element.type === "table" && (
            <button
              onClick={() => setActiveTab("rowBindings")}
              className={tabButtonClasses(activeTab === "rowBindings")}
            >
              Строки
            </button>
          )}
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5 text-sm">

        {/* Визуальные параметры */}
        {activeTab === "visual" && (
          <div className="space-y-5">
            {/* Ячейка таблицы: показывается только когда фокус (клик по ячейке на холсте)
                принадлежит этому элементу. Табличные свойства ниже остаются видимы —
                можно редактировать и таблицу целиком, и конкретную ячейку одновременно. */}
            {cellFocus && cellTargetKey && (
              <div className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Ячейка: строка {cellFocus.row + 1}, столбец {cellFocus.col + 1}
                  </h4>
                  <button
                    onClick={() => clearTableCellSelection()}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Снять выделение ячейки"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
                    Значение
                  </label>
                  <input
                    className={baseInputClasses}
                    value={cellData?.value ?? ""}
                    onChange={(e) => patchCell({value: e.target.value})}
                  />
                </div>

                {cellBinding && cellBindingRef && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs">
                    <Boxes size={13} className="text-emerald-500 shrink-0" />
                    <span className="text-gray-500 dark:text-gray-400">значение ←</span>
                    <span className="truncate flex-1">
                      {cellBindingRef.componentLabel} · {cellBindingRef.propertyName}
                    </span>
                    <button
                      onClick={() => removeBinding(element.key, cellBinding.id)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                      title="Отвязать"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                <ColorField
                  id="cell-bg"
                  label="Цвет фона ячейки"
                  value={cellData?.backgroundColor || "transparent"}
                  onChange={(v) => patchCell({backgroundColor: v})}
                  inputClassName={baseInputClasses}
                />
                <ColorField
                  id="cell-text-color"
                  label="Цвет текста ячейки"
                  value={cellData?.textColor || (renderedElementValues.textColor as string) || "#000000"}
                  onChange={(v) => patchCell({textColor: v})}
                  inputClassName={baseInputClasses}
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
                    Выравнивание
                  </label>
                  <select
                    className={cn(baseInputClasses, "appearance-none pr-8")}
                    value={cellData?.align ?? "left"}
                    onChange={(e) => patchCell({align: e.target.value as "left" | "center" | "right"})}
                  >
                    <option value="left">Слева</option>
                    <option value="center">По центру</option>
                    <option value="right">Справа</option>
                  </select>
                </div>

                {!cellBinding && (
                  <button
                    className={canBindCell
                      ? baseAddButtonClasses
                      : "flex items-center gap-2 py-2 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed"}
                    disabled={!canBindCell}
                    title={canBindCell ? undefined : "Сначала сохраните сцену и добавьте элементу свойство на вкладке «Свойства» — привязка требует сохранённого свойства."}
                    onClick={() => canBindCell && setCellPickerOpen(true)}
                  >
                    <Boxes size={16} />
                    Привязать к тегу
                  </button>
                )}

                <ChooseObjectPropertyModal
                  open={cellPickerOpen}
                  onClose={() => setCellPickerOpen(false)}
                  onPick={(picked) => {
                    setCellPickerOpen(false);
                    if (!cellTargetKey) return;
                    const taken = new Set(collectTagScope(element.properties).names);
                    addBinding(element.key, buildDirectBinding(cellTargetKey, picked, taken));
                  }}
                />
              </div>
            )}

            {/* Геометрия: точное позиционирование (координаты локальны родителю).
                У линии позиция кодируется концами x1/y1/x2/y2, а не x/y/w/h. */}
            <div>
              <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                Геометрия
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {(element.type === "line"
                  ? [
                      {key: "x1", label: "X1"}, {key: "y1", label: "Y1"},
                      {key: "x2", label: "X2"}, {key: "y2", label: "Y2"},
                    ]
                  : [
                      {key: "x", label: "X"}, {key: "y", label: "Y"},
                      {key: "w", label: "Ширина"}, {key: "h", label: "Высота"},
                      ...(element.type !== "group" ? [{key: "rotate", label: "Поворот°"}] : []),
                    ]
                ).map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label
                      htmlFor={`geom-${field.key}`}
                      className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`geom-${field.key}`}
                      type="number"
                      className={baseInputClasses}
                      value={getNumberValue(renderedElementValues[field.key])}
                      step={1}
                      onChange={(e) =>
                        updateElementVisual(element.key, {[field.key]: Number(e.target.value) || 0})
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700 mt-5" />
            </div>

            {/* Обычные параметры - два в ряд */}
            <div className="grid grid-cols-2 gap-4">
              {schema
                .filter(property => property.type !== "color")
                .map((property, index) => (
                  <div key={`${element.id}-${property.key}-${index}`}>
                    {renderPropertyInput(property, index)}
                  </div>
                ))}
            </div>

            {/* Цветовые параметры - полная ширина */}
            {schema.some(p => p.type === "color") && (
              <div className="space-y-4 pt-2">
                <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700" />
                <div className="space-y-4">
                  {schema
                    .filter(property => property.type === "color")
                    .map((property, index) => renderPropertyInput(property, index))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Состояния */}
        {activeTab === "states" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Состояние:
              </h4>
              <StateSelect elementKey={element.key} states={element.states}/>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Список состояний
              </h4>
              <div className="space-y-1.5">
                {element.states.map(state => (
                  <div
                    key={state.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60 px-3 py-1.5"
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {state.name}
                    </span>
                    {state.isDefault && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        по умолчанию
                      </span>
                    )}
                    {!state.isDefault && (
                      <button
                        className="ml-auto p-1 text-gray-500 hover:text-red-500 transition-colors"
                        title="Удалить состояние"
                        onClick={() => removeComponentState(state.name)}
                      >
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              className={baseAddButtonClasses}
              onClick={() => openInputModal({
                title: "Добавление нового состояния",
                description: "Введите название состояния",
                label: "Название состояния",
                placeholder: "Включено, Отключено, Открыто и тд",
                onConfirm: addComponentState
              })}
            >
              <Plus size={18}/>
              Добавить состояние
            </button>
          </div>
        )}

        {/* Свойства */}
        {activeTab === "properties" && element.type !== "table" && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Добавленные свойства
            </h4>

            {sortedProperties.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic py-3">
                Нет добавленных свойств
              </div>
            ) : (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handlePropertyDragEnd}>
                <SortableContext items={sortedProperties.map(p => p.id)} strategy={rectSortingStrategy}>
                  <div className="flex flex-wrap gap-2">
                    {sortedProperties.map(property => (
                      <SortablePropertyPill
                        key={property.id}
                        property={property}
                        onClick={() => handleAddProperty(element?.id, property)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {!canAddProperty && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{addPropertyHint}</span>
              </div>
            )}

            <button
              className={canAddProperty
                ? baseAddButtonClasses
                : "flex items-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed"}
              onClick={() => canAddProperty && handleAddProperty(element.id)}
              disabled={!canAddProperty}
              title={canAddProperty ? undefined : addPropertyHint}
            >
              <Plus size={18}/>
              Добавить свойство
            </button>
          </div>
        )}

        {/* Скрипты */}
        {activeTab === "scripts" && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Добавленные скрипты
            </h4>

            {elementScripts.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic py-3">
                Нет добавленных скриптов
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {elementScripts.map(script => (
                  <span
                    key={script.id}
                    className={`
                      inline-flex items-center px-2.5 py-1.5
                      text-xs font-medium rounded-full
                      bg-blue-950/60 text-blue-300
                      border border-blue-800/40
                      hover:bg-blue-900/70 transition-colors cursor-pointer
                    `}
                    onClick={() => {
                        openScriptEditorModal({
                          title: "Редактирование скрипта",
                          description: "Отредактируйте JS-код скрипта",
                          defaultName: script.name,
                          defaultContent: script.content,
                          onConfirm: (name, content) => {
                            const updatedScripts = elementScripts.map(s =>
                              s.id === script.id ? { ...s, name, content } : s
                            );
                            updateElement(element.key, { scripts: updatedScripts });
                          }
                        });
                    }}
                  >
                    {script.name}
                  </span>
                ))}
              </div>
            )}

            <button
              className={baseAddButtonClasses}
              onClick={handleAddScript}
            >
              <Plus size={18}/>
              Добавить скрипт
            </button>
          </div>
        )}

        {/* Привязки (JS-скрипты режима монитора) */}
        {activeTab === "bindings" && (
          <BindingsTab element={element} addButtonClasses={baseAddButtonClasses} />
        )}

        {/* События (onClick/onDoubleClick — JS режима монитора) */}
        {activeTab === "events" && <EventsTab element={element} />}

        {/* Строки таблицы: привязка к тегам (bulk-контракт properties) */}
        {activeTab === "rowBindings" && element.type === "table" && (
          <RowBindingsTab
            element={element}
            rows={getNumberValue(renderedElementValues.rows, 4)}
            cellsMap={cellsMap}
          />
        )}

      </div>
    </div>
  );
};
