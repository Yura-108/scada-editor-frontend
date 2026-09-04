"use client";

import React, {useEffect, useMemo} from "react";
import {PinOff} from "lucide-react";
import {DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent} from "@dnd-kit/core";
import {SortableContext, arrayMove, horizontalListSortingStrategy, useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {cn} from "@/lib/utils";
import {useEditorStore} from "@/store/useEditorStore";
import {usePinnedScenesStore} from "@/store/usePinnedScenesStore";
import {handleTabListKey} from "@/lib/editor/tabListKeys";

/**
 * Оболочка закреплённой вкладки: перетаскивание порядка.
 *
 * Объявлена НА УРОВНЕ МОДУЛЯ, а не внутри компонента полосы: компонент, созданный в теле
 * другого компонента, получает новый тип на каждый рендер, React размонтирует поддерево,
 * и жест перетаскивания рвётся на первом же обновлении стора.
 *
 * `listeners` уходят наружу render-пропом и вешаются на саму кнопку вкладки. `attributes`
 * от dnd-kit намеренно НЕ применяются: они ставят `role="button"` и свой `tabIndex`, а это
 * сломало бы и семантику `role="tab"`, и поиск соседей в `handleTabListKey` — тот ищет
 * `[role="tab"]` по DOM-порядку.
 */
function SortableTabShell({id, children}: {
  id: string;
  children: (dragListeners: Record<string, unknown>) => React.ReactNode;
}) {
  const {setNodeRef, listeners, transform, transition, isDragging} = useSortable({id});

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="group/tab shrink-0 flex items-center"
    >
      {children((listeners ?? {}) as Record<string, unknown>)}
    </div>
  );
}

/** Вкладка-не-схема: у редактора это «Рецепты», у монитора таких нет. */
export interface SceneTabDescriptor {
  key: string;
  label: string;
}

interface SceneTabsProps {
  /** Ключ активной вкладки: `scene:{id}` либо ключ `extraTab`/`fallbackTab`. */
  activeKey: string;
  /** Клик по вкладке или переход стрелками. */
  onActivate: (key: string) => void;
  /** Перетаскиваемая вкладка-не-схема; её место в ряду хранится в `recipesIndex`. */
  extraTab?: SceneTabDescriptor;
  /** Неперетаскиваемая заглушка на случай «ни схемы, ни закреплённых». */
  fallbackTab?: SceneTabDescriptor;
  /** id панели содержимого — для `aria-controls` вкладок. */
  contentId: string;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Панель быстрого доступа: закреплённые схемы (+ вкладка `extraTab`) → текущая схема,
 * если она не закреплена.
 *
 * Общая для редактора и монитора. Разница между экранами вынесена в пропы: что делать по
 * клику (редактор спрашивает про несохранённые правки, монитор просто грузит схему), нужна
 * ли вкладка «Рецепты» и заглушка «Редактор», какие отступы у полосы.
 *
 * Вкладка схемы — это тот же холст с другой загруженной схемой, поэтому собственного
 * состояния у полосы нет вовсе: что подсвечено, решает вызывающий через `activeKey`.
 */
export function SceneTabs({
  activeKey,
  onActivate,
  extraTab,
  fallbackTab,
  contentId,
  ariaLabel,
  className,
  style,
}: SceneTabsProps) {
  // Точечные селекторы: рядом с полосой на обоих экранах живёт тяжёлый Canvas.
  const scene = useEditorStore(s => s.scene);
  const sceneList = useEditorStore(s => s.sceneList);
  const currentProjectId = useEditorStore(s => s.currentProject?.id ?? null);
  const pins = usePinnedScenesStore(s => s.pins);
  const recipesIndex = usePinnedScenesStore(s => s.recipesIndex);
  const hydratePins = usePinnedScenesStore(s => s.hydrate);
  const unpinScene = usePinnedScenesStore(s => s.unpin);
  const reorderPins = usePinnedScenesStore(s => s.reorder);

  // Закреплённые схемы принадлежат проекту: при его смене список другой.
  useEffect(() => { hydratePins(); }, [currentProjectId, hydratePins]);

  /**
   * Ряд вкладок: перетаскиваемые (закреплённые схемы + `extraTab`) в порядке из
   * localStorage, затем текущая незакреплённая схема.
   *
   * Незакреплённая идёт последней и не перетаскивается намеренно: она временная —
   * закрепите, и она встанет в ряд на выбранное вами место.
   */
  const tabs = useMemo(() => {
    const nameOf = (id: number, fallback: string) =>
      sceneList.find(s => s.id === id)?.name ?? fallback;

    type Tab = {key: string; label: string; sceneId: number | null; draggable: boolean};

    const list: Tab[] = pins.map(pin => ({
      key: `scene:${pin.id}`,
      // Имя из списка схем свежее, чем запомненное при закреплении.
      label: nameOf(pin.id, pin.name),
      sceneId: pin.id,
      draggable: true,
    }));

    // `extraTab` — такая же перетаскиваемая вкладка, её место хранится индексом вставки.
    if (extraTab) {
      list.splice(Math.min(recipesIndex, list.length), 0, {
        ...extraTab, sceneId: null, draggable: true,
      });
    }

    if (scene && !pins.some(p => p.id === scene.id)) {
      list.push({
        key: `scene:${scene.id}`,
        label: nameOf(scene.id, scene.name),
        sceneId: scene.id,
        draggable: false,
      });
    }

    // Ни схемы, ни закреплённых: редактору нужна вкладка холста (на ней живёт ToolsPanel
    // с кнопкой «Загрузить схему», иначе с «Рецептов» было бы не выбраться).
    if (fallbackTab && !scene && !pins.length) {
      list.push({...fallbackTab, sceneId: null, draggable: false});
    }

    return list;
  }, [pins, recipesIndex, scene, sceneList, extraTab, fallbackTab]);

  /** Ключи перетаскиваемых вкладок в текущем порядке — их и сортирует dnd-kit. */
  const sortableTabKeys = useMemo(
    () => tabs.filter(t => t.draggable).map(t => t.key),
    [tabs],
  );

  // Только Pointer: клавиатурный сенсор dnd-kit перехватил бы стрелки, которыми
  // `handleTabListKey` ходит по вкладкам. Порог 4px оставляет обычный клик кликом.
  const tabDndSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}));

  const handleTabDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id) return;

    const from = sortableTabKeys.indexOf(String(active.id));
    const to = sortableTabKeys.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    // В стор уходит весь новый порядок ключей — из него он и достаёт список
    // закреплённых и место вкладки «Рецепты».
    reorderPins(arrayMove(sortableTabKeys, from, to));
  };

  const tabKeys = tabs.map(t => t.key);

  /**
   * Куда встаёт единственная остановка Tab (roving tabindex).
   *
   * Обычно это активная вкладка, но `activeKey` может не совпасть ни с одной: в мониторе
   * до выбора схемы активной вкладки нет вовсе. Тогда без запасного варианта у ВСЕХ
   * кнопок был бы `tabIndex={-1}`, и полоса выпадала бы из обхода с клавиатуры целиком.
   */
  const focusKey = tabKeys.includes(activeKey) ? activeKey : tabKeys[0];

  /** Сама кнопка вкладки. Вынесена, чтобы закреплённая и обычная рисовались одинаково. */
  const tabButtonNode = (
    tab: (typeof tabs)[number],
    dragListeners?: Record<string, unknown>,
  ) => {
    const isActive = activeKey === tab.key;
    return (
      <button
        id={`scene-tab-${tab.key}`}
        role="tab"
        type="button"
        aria-selected={isActive}
        aria-controls={contentId}
        tabIndex={tab.key === focusKey ? 0 : -1}
        onClick={() => onActivate(tab.key)}
        onKeyDown={(e) => handleTabListKey(e, tabKeys, activeKey, onActivate)}
        title={tab.sceneId !== null ? tab.label : undefined}
        className={cn(
          "shrink-0 max-w-48 truncate px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap",
          dragListeners && "cursor-grab active:cursor-grabbing",
          isActive
            ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 border-b-2 border-transparent",
        )}
        {...dragListeners}
      >
        {tab.label}
      </button>
    );
  };

  const renderTab = (tab: (typeof tabs)[number]) => {
    if (!tab.draggable) {
      return <React.Fragment key={tab.key}>{tabButtonNode(tab)}</React.Fragment>;
    }
    return (
      <SortableTabShell key={tab.key} id={tab.key}>
        {(dragListeners) => (
          <>
            {tabButtonNode(tab, dragListeners)}
            {/* Открепить можно только схему: «Рецепты» — постоянная вкладка, её
                перетаскивают, но не убирают.

                Кнопка СОСЕДНЯЯ, а не вложенная: кнопка внутри кнопки невалидна, и
                вложенный элемент сбил бы соответствие DOM-порядка `[role="tab"]` массиву
                вкладок. Слушателей перетаскивания на ней нет — иначе её было бы не нажать. */}
            {tab.sceneId !== null && (
              <button
                type="button"
                onClick={() => unpinScene(tab.sceneId!)}
                title={`Открепить «${tab.label}»`}
                aria-label={`Открепить схему «${tab.label}»`}
                className="ml-0.5 shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-indigo-500 focus:opacity-100 group-hover/tab:opacity-100"
              >
                <PinOff size={12} />
              </button>
            )}
          </>
        )}
      </SortableTabShell>
    );
  };

  // Показывать нечего — не занимаем 44px пустой полосой. Так бывает только там, где нет
  // ни `extraTab`, ни `fallbackTab`: у монитора до выбора схемы.
  if (!tabs.length) return null;

  return (
    <div
      style={style}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "h-11 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md flex items-center px-4 gap-2 overflow-x-auto custom-scrollbar",
        className,
      )}
    >
      {/* Перетаскиваются закреплённые схемы и «Рецепты». Текущая незакреплённая схема —
          вкладка временная, стоит последней и в сортировку не входит. */}
      <DndContext sensors={tabDndSensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
        <SortableContext items={sortableTabKeys} strategy={horizontalListSortingStrategy}>
          {tabs.map(renderTab)}
        </SortableContext>
      </DndContext>
    </div>
  );
}
