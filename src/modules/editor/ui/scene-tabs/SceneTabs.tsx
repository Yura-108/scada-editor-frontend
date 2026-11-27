'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/lib/cn';
import { useEditorStore } from '../../model/editorStore';
import { usePinnedScenesStore } from '../../model/pinnedScenesStore';
import { SceneTabButton } from './SceneTabButton';
import { PickerSelect } from '@/shared/ui/field/PickerSelect';
import { useSceneTabOverflow } from './useSceneTabOverflow';

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
function SortableTabShell({
  id,
  hidden,
  shrink,
  children,
}: {
  id: string;
  hidden: boolean;
  shrink: boolean;
  children: (dragListeners: Record<string, unknown>) => React.ReactNode;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id,
    disabled: hidden,
  });

  return (
    <div
      ref={setNodeRef}
      data-scene-tab={id}
      inert={hidden}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'flex items-center',
        shrink ? 'min-w-0 shrink' : 'shrink-0',
        hidden && 'pointer-events-none invisible absolute left-0',
      )}
    >
      {children((listeners ?? {}) as Record<string, unknown>)}
    </div>
  );
}

/** Вкладка-не-схема: у редактора это «Рецепты», у монитора таких нет. */
export interface SceneTabDescriptor {
  key: string;
  label: string;
  /**
   * Значок перед подписью. «Рецепты» без него не отличить от закреплённой схемы с тем же
   * названием (#10 п. 5).
   */
  icon?: LucideIcon;
}

interface SceneTabsProps {
  /** Ключ активной вкладки: `scene:{id}` либо ключ `extraTab`/`fallbackTab`. */
  activeKey: string;
  /** Клик по вкладке или переход стрелками. */
  onActivate: (key: string) => void;
  /** Перетаскиваемая вкладка-не-схема; её место в ряду хранится в `recipesIndex`. */
  extraTab?: SceneTabDescriptor;
  /** Неперетаскиваемая вкладка холста, пока схема не открыта. */
  fallbackTab?: SceneTabDescriptor;
  /** id панели содержимого — для `aria-controls` вкладок. */
  contentId: string;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Можно ли откреплять и перетаскивать вкладки. Закрепления — общая настройка проекта, и
   * меняет её только редактор; монитор показывает те же вкладки только для чтения.
   */
  editable?: boolean;
  /** Схема с несохранёнными правками — у её вкладки точка. Монитор не передаёт: там не правят. */
  dirtySceneId?: number | null;
  overflowMenu?: boolean;
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
  editable = true,
  dirtySceneId = null,
  overflowMenu = false,
}: SceneTabsProps) {
  // Точечные селекторы: рядом с полосой на обоих экранах живёт тяжёлый Canvas.
  const scene = useEditorStore((s) => s.scene);
  const sceneList = useEditorStore((s) => s.sceneList);
  const currentProjectId = useEditorStore((s) => s.currentProject?.id ?? null);
  const pins = usePinnedScenesStore((s) => s.pins);
  const recipesIndex = usePinnedScenesStore((s) => s.recipesIndex);
  const hydratePins = usePinnedScenesStore((s) => s.hydrate);
  const reorderPins = usePinnedScenesStore((s) => s.reorder);

  // Закреплённые схемы принадлежат проекту: при его смене список другой.
  useEffect(() => {
    hydratePins();
  }, [currentProjectId, hydratePins]);

  // Закрепления общие: коллега мог поменять их, пока вкладка браузера была в фоне — перечитываем
  // при возвращении, чтобы не ждать перезагрузки.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) hydratePins();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [hydratePins]);

  /**
   * Ряд вкладок: перетаскиваемые (закреплённые схемы + `extraTab`) в порядке из
   * localStorage, затем текущая незакреплённая схема.
   *
   * Незакреплённая идёт последней и не перетаскивается намеренно: она временная —
   * закрепите, и она встанет в ряд на выбранное вами место.
   */
  const tabs = useMemo(() => {
    const nameOf = (id: number, fallback: string) =>
      sceneList.find((s) => s.id === id)?.name ?? fallback;

    type Tab = {
      key: string;
      label: string;
      sceneId: number | null;
      draggable: boolean;
      icon?: LucideIcon;
    };

    // Закреплённая схема, которой нет в списке, не показывается: её удалили, а в мониторе — её
    // нет в prod-выпуске. Пока список не пришёл, показываем все (имена — из закрепления).
    const visiblePins = sceneList.length
      ? pins.filter((pin) => sceneList.some((s) => s.id === pin.id))
      : pins;

    const list: Tab[] = visiblePins.map((pin) => ({
      key: `scene:${pin.id}`,
      // Имя из списка схем свежее, чем запомненное при закреплении.
      label: nameOf(pin.id, pin.name),
      sceneId: pin.id,
      draggable: editable,
    }));

    // `extraTab` — такая же перетаскиваемая вкладка, её место хранится индексом вставки.
    if (extraTab) {
      list.splice(Math.min(recipesIndex, list.length), 0, {
        ...extraTab,
        sceneId: null,
        draggable: editable,
      });
    }

    if (scene && !pins.some((p) => p.id === scene.id)) {
      list.push({
        key: `scene:${scene.id}`,
        label: nameOf(scene.id, scene.name),
        sceneId: scene.id,
        draggable: false,
      });
    }

    // Холст остаётся доступен после выбора проекта с закреплёнными схемами.
    if (fallbackTab && !scene) {
      list.push({ ...fallbackTab, sceneId: null, draggable: false });
    }

    return list;
  }, [pins, recipesIndex, scene, sceneList, extraTab, fallbackTab, editable]);

  /** Ключи перетаскиваемых вкладок в текущем порядке — их и сортирует dnd-kit. */
  const sortableTabKeys = useMemo(() => tabs.filter((t) => t.draggable).map((t) => t.key), [tabs]);

  // Только Pointer: клавиатурный сенсор dnd-kit перехватил бы стрелки, которыми
  // `handleTabListKey` ходит по вкладкам. Порог 4px оставляет обычный клик кликом.
  const tabDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleTabDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = sortableTabKeys.indexOf(String(active.id));
    const to = sortableTabKeys.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    // В стор уходит весь новый порядок ключей — из него он и достаёт список
    // закреплённых и место вкладки «Рецепты».
    reorderPins(arrayMove(sortableTabKeys, from, to));
  };

  const stripRef = useRef<HTMLDivElement>(null);
  const hiddenKeys = useSceneTabOverflow(stripRef, tabs, overflowMenu, activeKey, extraTab?.key);
  const hiddenTabs = tabs.filter((tab) => hiddenKeys.includes(tab.key));
  const tabKeys = tabs.filter((tab) => !hiddenKeys.includes(tab.key)).map((tab) => tab.key);
  const shrinkActiveTab = hiddenTabs.length > 0 && tabKeys.length === 1;

  /**
   * Куда встаёт единственная остановка Tab (roving tabindex).
   *
   * Обычно это активная вкладка, но `activeKey` может не совпасть ни с одной: в мониторе
   * до выбора схемы активной вкладки нет вовсе. Тогда без запасного варианта у ВСЕХ
   * кнопок был бы `tabIndex={-1}`, и полоса выпадала бы из обхода с клавиатуры целиком.
   */
  const focusKey = tabKeys.includes(activeKey) ? activeKey : tabKeys[0];

  const tabButtonNode = (tab: (typeof tabs)[number], dragListeners?: Record<string, unknown>) => (
    <SceneTabButton
      tab={tab}
      activeKey={activeKey}
      focusKey={focusKey}
      visibleKeys={tabKeys}
      dirtySceneId={dirtySceneId}
      contentId={contentId}
      shrink={shrinkActiveTab && tab.key === focusKey}
      dragListeners={dragListeners}
      onActivate={onActivate}
    />
  );

  const renderTab = (tab: (typeof tabs)[number]) => {
    const hidden = hiddenKeys.includes(tab.key);
    const shrink = shrinkActiveTab && tab.key === focusKey;
    if (!tab.draggable) {
      return (
        <div
          key={tab.key}
          data-scene-tab={tab.key}
          inert={hidden}
          className={cn(
            'flex items-center',
            shrink ? 'min-w-0 shrink' : 'shrink-0',
            hidden && 'pointer-events-none invisible absolute left-0',
          )}
        >
          {tabButtonNode(tab)}
        </div>
      );
    }
    return (
      <SortableTabShell key={tab.key} id={tab.key} hidden={hidden} shrink={shrink}>
        {(dragListeners) => tabButtonNode(tab, dragListeners)}
      </SortableTabShell>
    );
  };

  // Активная вкладка всегда в видимой части полосы: новая схема встаёт в конец ряда, и раньше
  // её вкладка оставалась за краем, а полоса не прокручивалась (#10 п. 5).
  useEffect(() => {
    if (overflowMenu) return;
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>(
      `[id="scene-tab-${globalThis.CSS.escape(activeKey)}"]`,
    );
    if (!strip || !tab) return;
    const s = strip.getBoundingClientRect(),
      t = tab.getBoundingClientRect();
    if (t.left < s.left) strip.scrollBy({ left: t.left - s.left - 16 });
    else if (t.right > s.right) strip.scrollBy({ left: t.right - s.right + 16 });
  }, [activeKey, overflowMenu, tabs.length]);

  // Показывать нечего — не занимаем 44px пустой полосой. Так бывает только там, где нет
  // ни `extraTab`, ни `fallbackTab`: у монитора до выбора схемы.
  if (!tabs.length) return null;

  return (
    <div
      ref={stripRef}
      style={style}
      className={cn(
        // Тонкая полоса прокрутки: толстая под 13 вкладками съедала строку (#10 п. 5).
        'relative h-11 shrink-0 border-b border-border bg-card dark:bg-card/80 backdrop-blur-md flex items-center px-4 gap-2',
        overflowMenu ? 'overflow-hidden' : 'overflow-x-auto [scrollbar-width:thin]',
        className,
      )}
    >
      {/* Перетаскиваются закреплённые схемы и «Рецепты». Текущая незакреплённая схема —
          вкладка временная, стоит последней и в сортировку не входит. */}
      {/* Служебное объявление dnd-kit остаётся снаружи tablist. Закреплением управляют в выборе схемы. */}
      <DndContext
        sensors={tabDndSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleTabDragEnd}
      >
        <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 items-center gap-2">
          <SortableContext
            items={sortableTabKeys.filter((key) => !hiddenKeys.includes(key))}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map(renderTab)}
          </SortableContext>
        </div>
      </DndContext>
      {hiddenTabs.length > 0 && (
        <PickerSelect
          aria-label={`Ещё ${hiddenTabs.length} вкладок`}
          placeholder={`Ещё ${hiddenTabs.length}`}
          className="w-24 shrink-0"
          value={null}
          onValueChange={onActivate}
          items={hiddenTabs.map((tab) => ({
            value: tab.key,
            label: tab.label,
            meta: tab.icon ? <tab.icon size={14} aria-hidden /> : undefined,
          }))}
        />
      )}
    </div>
  );
}
