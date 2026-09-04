"use client";

import React, {useState, useMemo, useEffect} from "react";
import {DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent} from "@dnd-kit/core";
import {SortableContext, arrayMove, rectSortingStrategy, useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {cn, GRID} from "@/lib/utils";
import {DiagramElement, ElementType, PropertySchema, TableCellData} from "@/types/editorElement.type";
import {PropertyCreateDto} from "@/types/tags.types";
import {elementPropertyMap, basePropertySchema, elementTypeLabel, ROTATABLE_TYPES} from "@/constants/propertiesPanel";
import {Plus, AlertTriangle, Trash2, Boxes, GripVertical, Pencil, Layers, Check} from "lucide-react";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {confirmDeleteProperty} from "@/lib/editor/confirmDeleteProperty";
import {StateSelect} from "@/components/ui/StateSelect";
import {openInputModal} from "@/components/ui/OpenInputModal";
import {ColorField} from "@/components/ui/ColorField";
import {NumberInput} from "@/components/ui/NumberInput";
import {TextInput} from "@/components/ui/TextInput";
import {choiceModal, confirmModal, promptModal} from "@/components/ui/ConfirmModal";
import {toast} from "sonner";
import {openScriptEditorModal} from "@/components/ui/OpenScriptEditorModal";
import {useEditorStore} from "@/store/useEditorStore";
import {useDeviceStore} from "@/store/useDeviceStore";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {createUuid} from "@/lib/createUuid";
import {BindingsTab} from "@/components/editor/bindings/BindingsTab";
import {EventsTab} from "@/components/editor/events/EventsTab";
import {ChooseObjectPropertyModal} from "@/components/editor/bindings/OpenChooseObjectPropertyModal";
import {collectTagScope} from "@/lib/runtime/bindingScope";
import {buildDirectBinding} from "@/lib/runtime/directBinding";
import {cellRuntimeKey, getCellData, mergeCellPatch} from "@/lib/editor/tableCells";
import {CELL_SOURCE_FIELDS, cellBindingAt} from "@/lib/editor/tableBindings";
import {MIN_TRACK, headerHeight, resolveTracks, setTrackSize} from "@/lib/editor/tableLayout";
import {shortTagPath} from "@/lib/editor/tagPath";
import {MIN_SIZE} from "@/components/editor/canvas/types";
import type {CellSourceField} from "@/types/binding.types";

interface PropertiesPanelProps {
  element: DiagramElement | null;
}

/**
 * «Таблетка» свойства в общем списке: ручка перетаскивания (attributes/listeners
 * dnd-kit) висит ТОЛЬКО на иконке — остальная часть таблетки сохраняет исходный
 * onClick открытия модалки редактирования, drag и клик не конфликтуют.
 */
/**
 * Ключ свойства в списке.
 *
 * Серверного id может не быть: свойства из шаблона палитры приезжают черновиками (тег
 * у каждого экземпляра свой, а без тега свойство на сервере не заводится). Для таких
 * ключом служит имя — в пределах одного элемента оно и так обязано быть уникальным,
 * по нему идёт разрешение ссылок и сбор скоупа биндингов.
 */
const propertyKey = (p: PropertyCreateDto): string =>
  p.id != null ? `id-${p.id}` : `draft-${p.name}`;

/** Теговое свойство без тега — черновик из шаблона, его надо донастроить. */
const needsTag = (p: PropertyCreateDto): boolean =>
  p.property_type === "Тег" && !p.tag_id;

function SortablePropertyPill({property, onClick, onDelete}: {property: PropertyCreateDto; onClick: () => void; onDelete: () => void}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: propertyKey(property)});
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const wantsTag = needsTag(property);
  const label = `${property.name || property.property_type || "Свойство"}${
    property.tag_id ? ` • ${shortTagPath(property.tag_id)}` : wantsTag ? " • нужен тег" : ""
  }`;

  // Ручка и подпись — две отдельные кнопки внутри оболочки-таблетки.
  // Кнопку внутрь кнопки вкладывать нельзя, а раньше и то и другое было
  // кликабельными <span>: таблетка не открывалась с клавиатуры, а ручка dnd-kit
  // не получала фокус, из-за чего клавиатурное перетаскивание не работало.
  return (
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1.5",
        "text-xs font-medium rounded-full",
        "border transition-colors",
        // Ненастроенное теговое свойство видно списком, без раскрытия каждой строки.
        wantsTag
          ? "bg-amber-950/60 text-amber-300 border-amber-700/50 hover:bg-amber-900/70"
          : "bg-indigo-950/60 text-indigo-300 border-indigo-800/40 hover:bg-indigo-900/70"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn("cursor-grab active:cursor-grabbing -ml-1",
          wantsTag ? "text-amber-400/70 hover:text-amber-200" : "text-indigo-400/70 hover:text-indigo-200")}
        title="Перетащить для изменения порядка"
        aria-label={`Перетащить «${label}» для изменения порядка`}
      >
        <GripVertical size={12} />
      </button>
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer text-left"
        title={property.tag_id ?? undefined}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn("hover:text-red-400 transition-colors -mr-1",
          wantsTag ? "text-amber-400/70" : "text-indigo-400/70")}
        title="Удалить свойство"
        aria-label={`Удалить «${label}»`}
      >
        <Trash2 size={12} />
      </button>
    </span>
  );
}

type TabType = "visual" | "states" | "properties" | "scripts" | "bindings" | "events";

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({element}) => {
  const [activeTab, setActiveTab] = useState<TabType>("visual");
  // Точечные селекторы: подписка на весь стор ре-рендерила панель на каждый тик пана/зума.
  const updateElement = useEditorStore(s => s.updateElement);
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);
  const addComponentStateToSubtree = useEditorStore(s => s.addComponentStateToSubtree);
  const removeComponentStateFromSubtree = useEditorStore(s => s.removeComponentStateFromSubtree);
  const renameComponentStateInSubtree = useEditorStore(s => s.renameComponentStateInSubtree);
  const findStateUsages = useEditorStore(s => s.findStateUsages);
  const setCurrentComponentStateId = useEditorStore(s => s.setCurrentComponentStateId);
  const currentComponentStateByElementKey = useEditorStore(s => s.currentComponentStateByElementKey);
  const selectedTableCell = useEditorStore(s => s.selectedTableCell);
  const editAllStates = useEditorStore(s => s.editAllStates);
  const setEditAllStates = useEditorStore(s => s.setEditAllStates);
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
  const elementProperties = useMemo(() => element?.properties ?? [], [element?.properties]);
  // Локальный порядок во время/сразу после драга — визуальная обратная связь до
  // того, как все editProperty-запросы вернутся и стор пересчитает elementProperties.
  // Сброс при смене элемента — во время рендера (React-паттерн "adjusting state
  // during render"), не в эффекте: избегает лишнего ре-рендера/cascading setState.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [localOrderElementKey, setLocalOrderElementKey] = useState(element?.key);
  if (element?.key !== localOrderElementKey) {
    setLocalOrderElementKey(element?.key);
    setLocalOrder(null);
  }
  const sortedProperties = useMemo(() => {
    const base = [...elementProperties].sort((a, b) =>
      (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
      || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
    );
    if (!localOrder) return base;
    const byId = new Map(base.map(p => [propertyKey(p), p] as const));
    const reordered = localOrder.map(id => byId.get(id)).filter((p): p is PropertyCreateDto => Boolean(p));
    for (const p of base) if (!localOrder.includes(propertyKey(p))) reordered.push(p);
    return reordered;
  }, [elementProperties, localOrder]);
  const dndSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}));
  const handlePropertyDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id) return;
    const ids = sortedProperties.map(propertyKey);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedIds = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder(reorderedIds);

    // Порядок — обычное поле свойства, уезжает со сценой. Раньше это была пачка запросов
    // editProperty (по одному на сдвинутую строку, каждый ещё и с GET версии), причём
    // необработанный reject терял половину перестановки молча.
    const orderByKey = new Map(reorderedIds.map((id, index) => [id, index] as const));
    updateElement(element!.key, {
      properties: (element!.properties ?? []).map(p => {
        const position = orderByKey.get(propertyKey(p));
        return position === undefined || p.position === position ? p : {...p, position};
      }),
    });
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

  // Пустое состояние живёт в WorkSpace: панель свойств рендерится только когда
  // выбран ровно один элемент, поэтому эта ветка была недостижима — два разных
  // текста на одно и то же условие.
  if (!element) return null;

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

  const removeComponentState = async (stateName: string) => {
    const confirmed = await confirmModal({
      title: `Удалить состояние «${stateName}»?`,
      description: "Визуальные настройки этого состояния будут потеряны.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!confirmed) return;
    removeComponentStateFromSubtree(element.key, stateName);
  }

  const renameComponentState = async (stateName: string) => {
    const next = (await promptModal({
      title: "Переименовать состояние",
      label: "Название состояния",
      defaultValue: stateName,
      confirmLabel: "Сохранить",
    }))?.trim();
    if (!next || next === stateName) return;

    // Имена состояний обязаны быть уникальными: по имени идут find() в каскаде,
    // в рантайме и при запекании composition (побеждает первое совпадение), а
    // удаление сносит все одноимённые разом.
    if (element.states.some(s => s.name === next)) {
      toast.error(`Состояние «${next}» уже есть у этого элемента`);
      return;
    }

    // Имя состояния лежит в пользовательском коде строковым литералом
    // (setState("Авария")), и рантайм при несовпадении молча пропускает интент.
    const usages = findStateUsages(element.key, stateName);
    let rewriteCode = false;

    if (usages.length) {
      const choice = await choiceModal({
        title: `Переименовать «${stateName}» в «${next}»?`,
        description: (
          <div className="space-y-1">
            <p>Старое имя встречается в коде:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {usages.map((u, i) => (
                <li key={`${u.elementKey}-${i}`}>{u.elementLabel} — {u.where}</li>
              ))}
            </ul>
          </div>
        ),
        options: [
          {id: "rename-and-fix", label: "Переименовать и заменить в коде"},
          {
            id: "rename-only",
            label: "Переименовать без замены",
            description: "Скрипты со старым именем перестанут срабатывать",
            danger: true,
          },
        ],
      });
      if (!choice) return;
      rewriteCode = choice === "rename-and-fix";
    }

    renameComponentStateInSubtree(element.key, stateName, next, {rewriteCode});
  }

  const handleAddScript = () => {
    if (!element) return;
    openScriptEditorModal({
      title: "Добавление скрипта",
      // Скрипты компонента исполняются НА СЕРВЕРЕ (Java): монитор только шлёт
      // ACTION с их id (см. runScript в useRuntimeEngine). Обработчики событий и
      // привязки — наоборот, JavaScript в браузере. Раньше подписи путали одно
      // с другим: «Напишите Java-код для обработки событий» здесь и
      // «Отредактируйте JS-код скрипта» на соседней кнопке.
      description: "Java-код, который выполнится на сервере. Вызывается из обработчика события через runScript(\"Имя\").",
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

  /**
   * Поля блока «Геометрия» — ровно те, что рендерер действительно читает.
   *
   * Раньше панель расходилась с холстом в двух местах: «Поворот°» показывался
   * для всех типов кроме группы, хотя `rotation` прокидывает только часть фигур
   * (см. ROTATABLE_TYPES); а у круга правились «Ширина»/«Высота», тогда как
   * рендерер берёт `radius || w / 2` — то есть ввод ширины ничего не менял.
   */
  const geometryFields: {key: string; label: string; value?: number; commit?: (v: number) => Record<string, unknown>}[] =
    element.type === "line"
      ? [
          {key: "x1", label: "X1"}, {key: "y1", label: "Y1"},
          {key: "x2", label: "X2"}, {key: "y2", label: "Y2"},
        ]
      : element.type === "curve"
        // Форму кривой задают четыре точки — их правят ручками на холсте, числами это
        // было бы восемь полей. В панели остаётся положение; w/h пересчитываются сами.
        ? [{key: "x", label: "X"}, {key: "y", label: "Y"}]
      : element.type === "text"
        // У текста габарит вычисляемый: `h` не пишется вообще ничем и остаётся
        // ископаемым значением из `addElementAt`, а `w` действует только в режиме
        // фиксированной ширины (`autoWidth === false`). Показывать оба поля значило бы
        // предлагать править числа, которых рендерер не читает. В авторежиме ширину
        // задаёт ручка на холсте, вернуть его — двойной клик по ней.
        ? [
            {key: "x", label: "X"}, {key: "y", label: "Y"},
            ...(renderedElementValues.autoWidth === false
              ? [{
                  key: "w",
                  label: "Ширина",
                  commit: (v: number) => ({w: Math.max(MIN_SIZE, v), autoWidth: false}),
                }]
              : []),
          ]
      : element.type === "circle" || element.type === "arc"
        ? (() => {
            // Круг и дуга описываются ЦЕНТРОМ и радиусом — так их двигает холст (центр
            // садится в узел сетки), так их задают ручки и так приходит выгрузка CONTUR.
            // В модели же в `x, y` лежит левый верхний угол габарита, поэтому панель
            // переводит одно в другое, а не показывает угол: иначе поля и жест на холсте
            // описывали бы разные точки.
            // Тот же порядок запасных значений, что у рендера (`radius || w / 2 || …`):
            // панель обязана описывать ровно то, что нарисовано.
            const isArc = element.type === "arc";
            const r =
              getNumberValue(renderedElementValues.radius, getNumberValue(renderedElementValues.w) / 2)
              || (isArc ? 60 : 40);
            const cx = getNumberValue(renderedElementValues.x) + r;
            const cy = getNumberValue(renderedElementValues.y) + r;
            return [
              {key: "cx", label: "X центра", value: cx, commit: (v: number) => ({x: v - r})},
              {key: "cy", label: "Y центра", value: cy, commit: (v: number) => ({y: v - r})},
              {
                key: "radius",
                label: "Радиус",
                // Растём вокруг центра — как ручка на холсте. `w/h` держим равными
                // диаметру: рендер берёт radius, а выделение и рамка группы — w/h.
                commit: (v: number) => {
                  const nr = Math.max(1, v);
                  return {radius: nr, w: nr * 2, h: nr * 2, x: cx - nr, y: cy - nr};
                },
              },
              // Дуга: начало живёт в общем `rotate` (своего поворота у неё нет —
              // поворот дуги это и есть её начальный угол), раствор — в `angle`.
              ...(isArc
                ? [
                    {
                      key: "rotate",
                      label: "Начало, °",
                      commit: (v: number) => ({rotate: ((v % 360) + 360) % 360}),
                    },
                    {
                      key: "angle",
                      label: "Раствор, °",
                      commit: (v: number) => ({angle: Math.min(360, Math.max(1, Math.round(v)))}),
                    },
                  ]
                : []),
            ];
          })()
        : [
            {key: "x", label: "X"}, {key: "y", label: "Y"},
            {key: "w", label: "Ширина"}, {key: "h", label: "Высота"},
            ...(ROTATABLE_TYPES.has(element.type as ElementType)
              ? [{key: "rotate", label: "Поворот°"}]
              : []),
          ];

  // Требование «сначала сохраните схему» снято: свойства едут вместе со сценой, и
  // заводить их можно элементу, которого на сервере ещё нет. Осталось единственное
  // условие — загруженная база каналов, без неё не из чего выбрать тег.
  const canAddProperty = isChannelBaseLoaded;
  const addPropertyHint =
    "Откройте раздел «База каналов» и загрузите проект — без дерева устройств не из чего выбрать тег.";

  // Сфокусированная ячейка таблицы (панель свойств показывает cell-блок только пока
  // фокус принадлежит ИМЕННО этому элементу — переживает переключение вкладок).
  const cellFocus = element.type === "table" && selectedTableCell?.elementKey === element.key
    ? selectedTableCell
    : null;
  const cellsMap = renderedElementValues.cells as Record<string, TableCellData> | undefined;
  const cellData = cellFocus ? getCellData(cellsMap, cellFocus.row, cellFocus.col) : undefined;
  const cellTargetKey = cellFocus ? cellRuntimeKey(cellFocus.row, cellFocus.col) : null;
  // Привязка ячейки к полю СВОЕГО свойства (новая модель, см. tableBindings.ts).
  const ownCellBinding = cellFocus ? cellBindingAt(element, cellFocus.row, cellFocus.col) : undefined;
  // Прежняя межкомпонентная привязка ячейки (direct + directTarget) — живёт своим путём.
  const cellBinding = cellTargetKey
    ? (element.bindings ?? []).find(b => b.direct && b.directTarget === cellTargetKey)
    : undefined;
  const cellBindingRef = cellBinding?.propertyRefs?.[0];

  /** Привязать ячейку к полю свойства (или переназначить). */
  const bindCell = (propertyName: string, field: CellSourceField) => {
    if (!cellFocus) return;
    if (ownCellBinding) removeBinding(element.key, ownCellBinding.id);
    addBinding(element.key, {
      v: 1,
      id: createUuid(),
      name: propertyName,
      enabled: true,
      code: "",
      cell: {row: cellFocus.row, col: cellFocus.col, propertyName, field},
    });
  };
  // Ячейку можно привязать, как только у элемента есть свойство: сохранённость больше
  // не требуется — свойство уезжает вместе со сценой.
  const canBindCell = (element.properties?.length ?? 0) > 0;

  const patchCell = (patch: Partial<TableCellData>) => {
    if (!cellFocus) return;
    updateElementVisual(element.key, {
      cells: mergeCellPatch(cellsMap, cellFocus.row, cellFocus.col, patch),
    });
  };

  // ---- Размеры полос таблицы ----
  // Считаются тем же кодом, что и рендер: в элементе лежат ВЕСА, а показывать и
  // редактировать надо фактические единицы сцены (см. src/lib/editor/tableLayout.ts).
  const tableTracks = element.type !== "table" ? null : (() => {
    const w = getNumberValue(renderedElementValues.w, 300);
    const h = getNumberValue(renderedElementValues.h, 160);
    const rows = Math.max(1, Math.round(getNumberValue(renderedElementValues.rows, 4)));
    const cols = Math.max(1, Math.round(getNumberValue(renderedElementValues.cols, 3)));
    const showHeader = renderedElementValues.showHeader !== false;
    const fontSize = getNumberValue(renderedElementValues.fontSize, 12);
    const headerH = headerHeight(showHeader, fontSize, renderedElementValues.headerH);
    return {
      rows, cols, h, headerH, showHeader,
      colWs: resolveTracks(renderedElementValues.colWidths, cols, w),
      rowHs: resolveTracks(renderedElementValues.rowHeights, rows, h - headerH),
    };
  })();

  /** Задать ширину столбца / высоту строки: разница снимается с соседней полосы. */
  const setTableTrack = (axis: "col" | "row", index: number, size: number) => {
    if (!tableTracks) return;
    updateElementVisual(element.key, axis === "col"
      ? {colWidths: setTrackSize(tableTracks.colWs, index, size)}
      : {rowHeights: setTrackSize(tableTracks.rowHs, index, size)});
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

  /**
   * Переключатель «Править все состояния».
   *
   * Показывается на ОБЕИХ вкладках: заводят его на «Состояниях», а пользуются им на
   * «Визуале» — там правят цвет, текст и геометрию. Гонять пользователя между вкладками
   * ради галочки, которая влияет ровно на соседние поля, незачем.
   */
  const editAllStatesToggle = (withHint: boolean) => (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={editAllStates}
        onClick={() => setEditAllStates(!editAllStates)}
        className={cn(
          "w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
          editAllStates
            ? "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-neutral-800/60",
        )}
      >
        <span className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          editAllStates
            ? "border-amber-500 bg-amber-500 text-white"
            : "border-gray-400 dark:border-neutral-600",
        )}>
          {editAllStates && <Check size={12}/>}
        </span>
        Править все состояния
      </button>
      {withHint && (
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-neutral-500">
          Пока включено, правки визуала пишутся во все состояния элемента сразу.
        </p>
      )}
    </div>
  );

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
            {/* Коммит по blur/Enter, а не на каждый символ: иначе каждое нажатие
                клавиши — новый массив elements, то есть шаг undo на символ и
                полный пересчёт схемы с перерисовкой холста. */}
            <TextInput
              id={`prop-${property.key}`}
              className={baseInputClasses}
              value={textValue}
              placeholder={property.placeholder || ""}
              onCommit={(v) => updateElementVisual(element.key, {[property.key]: v})}
            />
          </div>
        );

      case "number":
        return (
          <div key={uniqueKey} className="space-y-1.5">
            {label}
            <NumberInput
              id={`prop-${property.key}`}
              className={baseInputClasses}
              value={numberValue}
              min={property.min}
              max={property.max}
              step={property.step ?? 1}
              onCommit={(v) => updateElementVisual(element.key, {[property.key]: v})}
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
        {/* Единый вид заголовка панели (как в «Слоях»): раньше здесь был
            h3 text-base «Progress_bar Properties», в LayersPanel — h3 text-xs
            uppercase, а в RecipesPanel — h1 text-2xl. */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Свойства: {elementTypeLabel(element.type)}
        </h3>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 font-mono">
          ID: {element.key.slice(0, 8)}...
        </p>
      </div>

      {/* Режим правки всех состояний виден на ЛЮБОЙ вкладке: иначе про него забывают,
          и правка «только для Аварии» молча растекается по всем состояниям — ровно та
          ошибка, от которой режим и должен спасать. */}
      {editAllStates && (
        <div className="shrink-0 mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2">
          <Layers size={14} className="shrink-0 text-amber-600 dark:text-amber-400"/>
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Правка идёт во все состояния
          </span>
          <button
            type="button"
            onClick={() => setEditAllStates(false)}
            className="ml-auto text-xs text-amber-700 hover:underline dark:text-amber-300"
          >
            Выключить
          </button>
        </div>
      )}

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
          {/* Таблице вкладка нужна наравне со всеми: её теговые свойства висят на
              ней целиком, а ячейки лишь ссылаются на них привязками. Прежде свойства
              таблицы заводились отдельной вкладкой «Строки» — она ушла. */}
          <button
            onClick={() => setActiveTab("properties")}
            className={tabButtonClasses(activeTab === "properties")}
          >
            Свойства
          </button>
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
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5 text-sm">

        {/* Визуальные параметры */}
        {activeTab === "visual" && (
          <div className="space-y-5">
            {/* Текущее состояние — прямо здесь, а не только на вкладке «Состояния».
                Значения ниже относятся ИМЕННО к нему (у листьев они лежат в
                states[].overrides), и без этой строки было неочевидно, чей визуал
                правится: переключил состояние на другой вкладке — и те же поля
                показывают уже другие числа. */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
                Состояние
              </label>
              <StateSelect elementKey={element.key} states={element.states}/>
              {element.states.length > 1 && (
                <p className={cn(
                  "text-[11px]",
                  editAllStates
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-gray-500 dark:text-neutral-500",
                )}>
                  {editAllStates
                    ? "Значения ниже пишутся во ВСЕ состояния элемента."
                    : "Значения ниже относятся к этому состоянию."}
                </p>
              )}
              {/* У элемента с единственным состоянием переключать нечего. Подпись под
                  ним не дублируем — строка выше уже сказала, куда лягут значения. */}
              {element.states.length > 1 && editAllStatesToggle(false)}
            </div>

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
                    type="button"
                    onClick={() => clearTableCellSelection()}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Снять выделение ячейки"
                    aria-label="Снять выделение ячейки"
                  >
                    <span aria-hidden>✕</span>
                  </button>
                </div>

                {/* Привязка ячейки к полю свойства таблицы. Свойства заводятся на
                    вкладке «Свойства» — они принадлежат таблице целиком, а здесь
                    указывается только, что из них показать в этой ячейке. */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
                      Свойство
                    </label>
                    <select
                      className={cn(baseInputClasses, "appearance-none pr-8")}
                      value={ownCellBinding?.cell?.propertyName ?? ""}
                      onChange={(e) => {
                        const name = e.target.value;
                        if (!name) {
                          if (ownCellBinding) removeBinding(element.key, ownCellBinding.id);
                          return;
                        }
                        bindCell(name, ownCellBinding?.cell?.field ?? "value");
                      }}
                    >
                      <option value="">— свободный текст —</option>
                      {(element.properties ?? []).map(p => (
                        <option key={propertyKey(p)} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
                      Поле
                    </label>
                    <select
                      className={cn(baseInputClasses, "appearance-none pr-8")}
                      value={ownCellBinding?.cell?.field ?? "value"}
                      disabled={!ownCellBinding}
                      onChange={(e) => {
                        if (!ownCellBinding?.cell) return;
                        bindCell(ownCellBinding.cell.propertyName, e.target.value as CellSourceField);
                      }}
                    >
                      {CELL_SOURCE_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!ownCellBinding && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight">
                      Текст
                    </label>
                    {/* Как и остальные текстовые поля: коммит по blur/Enter —
                        значение ячейки уходит в схему целиком, а не посимвольно. */}
                    <TextInput
                      className={baseInputClasses}
                      value={cellData?.value ?? ""}
                      onCommit={(v) => patchCell({value: v})}
                    />
                  </div>
                )}

                {(element.properties?.length ?? 0) === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    У таблицы нет свойств — добавьте их на вкладке «Свойства», чтобы
                    привязывать ячейки.
                  </p>
                )}

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

                {/* Размер полос, которым принадлежит ячейка. Правится и мышью —
                    границы столбцов/строк на холсте (TableResizeHandles). */}
                {tableTracks && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cell-col-width"
                        className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight"
                      >
                        Ширина столбца
                      </label>
                      <NumberInput
                        id="cell-col-width"
                        className={baseInputClasses}
                        value={Math.round(tableTracks.colWs[cellFocus.col] ?? 0)}
                        step={GRID}
                        onCommit={(v) => setTableTrack("col", cellFocus.col, v)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cell-row-height"
                        className="block text-xs font-medium text-gray-600 dark:text-neutral-400 tracking-tight"
                      >
                        Высота строки
                      </label>
                      <NumberInput
                        id="cell-row-height"
                        className={baseInputClasses}
                        value={Math.round(tableTracks.rowHs[cellFocus.row] ?? 0)}
                        step={GRID}
                        onCommit={(v) => setTableTrack("row", cellFocus.row, v)}
                      />
                    </div>
                  </div>
                )}

                {!cellBinding && (
                  <button
                    className={canBindCell
                      ? baseAddButtonClasses
                      : "flex items-center gap-2 py-2 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed"}
                    disabled={!canBindCell}
                    title={canBindCell ? undefined : "Сначала сохраните схему и добавьте элементу свойство на вкладке «Свойства» — привязка требует сохранённого свойства."}
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

            {/* Размеры таблицы, не привязанные к конкретной ячейке. «Выровнять»
                стирает веса — раскладка возвращается к равномерной сетке. */}
            {tableTracks && (
              <div>
                <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                  Размеры таблицы
                </h4>
                <div className="grid grid-cols-2 gap-4 items-end">
                  {tableTracks.showHeader && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="table-header-h"
                        className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
                      >
                        Высота заголовка
                      </label>
                      <NumberInput
                        id="table-header-h"
                        className={baseInputClasses}
                        value={Math.round(tableTracks.headerH)}
                        step={GRID}
                        onCommit={(v) => updateElementVisual(element.key, {
                          // Телу таблицы обязана остаться хотя бы клетка на строку.
                          headerH: Math.min(
                            Math.max(MIN_TRACK, v),
                            Math.max(MIN_TRACK, tableTracks.h - tableTracks.rows * MIN_TRACK),
                          ),
                        })}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    className={cn(baseInputClasses, "cursor-pointer text-center hover:bg-gray-100 dark:hover:bg-neutral-800")}
                    title="Сделать все столбцы и строки одинаковыми"
                    onClick={() => updateElementVisual(element.key, {colWidths: undefined, rowHeights: undefined})}
                  >
                    Выровнять
                  </button>
                </div>
                <div className="h-px bg-linear-to-r from-neutral-700 via-neutral-600 to-neutral-700 mt-5" />
              </div>
            )}

            {/* Геометрия: точное позиционирование (координаты локальны родителю).
                У линии позиция кодируется концами x1/y1/x2/y2, а не x/y/w/h. */}
            <div>
              <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 mb-2 uppercase tracking-wider">
                Геометрия
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {geometryFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label
                      htmlFor={`geom-${field.key}`}
                      className="block text-xs font-medium text-gray-600 dark:text-neutral-400 mb-1.5 tracking-tight"
                    >
                      {field.label}
                    </label>
                    <NumberInput
                      id={`geom-${field.key}`}
                      className={baseInputClasses}
                      value={field.value ?? getNumberValue(renderedElementValues[field.key])}
                      step={1}
                      onCommit={(v) =>
                        updateElementVisual(element.key, field.commit ? field.commit(v) : {[field.key]: v})
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

            {editAllStatesToggle(true)}

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
                    {/* ml-auto на общей обёртке, а не на корзине: у состояния по
                        умолчанию корзины нет, и карандаш прижался бы к имени. */}
                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                        title="Переименовать состояние"
                        aria-label={`Переименовать «${state.name}»`}
                        onClick={() => renameComponentState(state.name)}
                      >
                        <Pencil size={14}/>
                      </button>
                      {!state.isDefault && (
                        <button
                          className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                          title="Удалить состояние"
                          aria-label={`Удалить «${state.name}»`}
                          onClick={() => removeComponentState(state.name)}
                        >
                          <Trash2 size={14}/>
                        </button>
                      )}
                    </div>
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
        {activeTab === "properties" && (
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
                <SortableContext items={sortedProperties.map(propertyKey)} strategy={rectSortingStrategy}>
                  <div className="flex flex-wrap gap-2">
                    {sortedProperties.map(property => (
                      <SortablePropertyPill
                        key={propertyKey(property)}
                        property={property}
                        onClick={() => handleAddProperty(element?.key, property)}
                        onDelete={() => {
                          if (!element?.key) return;
                          void confirmDeleteProperty(property, element.key);
                        }}
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
              onClick={() => canAddProperty && handleAddProperty(element.key)}
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
                  <button
                    key={script.id}
                    type="button"
                    title={`Редактировать скрипт «${script.name}»`}
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
                          description: "Java-код, который выполнится на сервере. Вызывается из обработчика события через runScript(\"Имя\").",
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
                  </button>
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


      </div>
    </div>
  );
};
