import {ChevronLeft, ChevronRight, PanelLeft, PanelRight} from "lucide-react";
import {PropertiesPanel} from "@/components/editor/PropertiesPanel";
import {MultiPropertiesPanel} from "@/components/editor/MultiPropertiesPanel";
import {ScenePropertiesPanel} from "@/components/editor/ScenePropertiesPanel";
import {LayersPanel} from "@/components/editor/LayersPanel";
import {useEditorStore} from "@/store/useEditorStore";
import {openSceneGuarded} from "@/lib/editor/openScene";
import {SceneTabs} from "@/components/editor/SceneTabs";
import {handleTabListKey} from "@/lib/editor/tabListKeys";
import React, {useMemo, useRef, useState, useEffect} from "react";
import Palette from "./Palette";
import ToolsPanel from "@/components/editor/ToolsPanel";
import {cn} from "@/lib/utils";
import {EditorPanel} from "@/components/editor/panels/EditorPanel";
import {RecipesPanel} from "@/components/editor/panels/RecipesPanel";

// Готовы только «Редактор» и «Рецепты». Раньше здесь были ещё 8 вкладок-заглушек
// (по 7 строк каждая) — они импортировались и разводились в switch, но ни одна
// не была достижима: полоса вкладок с ними закомментирована. Заглушки удалены,
// вернуть их можно вместе с реальным содержимым.
type TabType = "editor" | "recipes";
type LeftTabType = "palette" | "layers";

// Порядок вкладок для навигации стрелками.
const MAIN_TABS = ["editor", "recipes"] as const satisfies readonly TabType[];

// Вкладки-не-схемы для SceneTabs. На уровне модуля, а не литералом в JSX: новый объект
// на каждый рендер сбрасывал бы мемоизацию ряда вкладок внутри компонента.
const RECIPES_TAB = {key: "recipes", label: "Рецепты"} as const;
const EDITOR_TAB = {key: "editor", label: "Редактор"} as const;
const LEFT_TABS = ["palette", "layers"] as const satisfies readonly LeftTabType[];

// Ширины боковых панелей: дефолт/максимум/порог, ниже которого перетаскивание края схлопывает панель.
const LEFT_DEFAULT = 288, LEFT_MAX = 480, LEFT_COLLAPSE = 160;
const RIGHT_DEFAULT = 320, RIGHT_MAX = 520, RIGHT_COLLAPSE = 180;
/**
 * Раскладка редактора в localStorage.
 *
 * Раньше здесь было два ключа только под ширины, и каждый эффект писал в
 * хранилище на КАЖДЫЙ пиксель перетаскивания края панели (сотни синхронных
 * записей на один жест). Теперь одна запись на всю раскладку, отложенная на
 * SAVE_DELAY после последнего изменения, и в неё попали свёрнутость панелей и
 * активные вкладки — их состояние терялось при перезагрузке.
 */
const LS_LAYOUT = "scada-editor:layout";
const SAVE_DELAY = 300;

type PersistedLayout = {
  leftWidth: number;
  rightWidth: number;
  leftVisible: boolean;
  rightVisible: boolean;
  leftTab: LeftTabType;
  activeTab: TabType;
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const readLayout = (): Partial<PersistedLayout> => {
  try {
    const raw = localStorage.getItem(LS_LAYOUT);
    return raw ? (JSON.parse(raw) as Partial<PersistedLayout>) : {};
  } catch {
    return {};
  }
};

export default function WorkSpace() {
  // Точечные селекторы вместо подписки на весь стор: иначе каждый тик пана/зума
  // ре-рендерил WorkSpace и каскадом весь Canvas со всеми фигурами.
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectedElement = useEditorStore(s => s.elements.find(el => el.key === s.selectedIds[0]));
  const elements = useEditorStore(s => s.elements);
  const isVersionPreview = useEditorStore(s => s.versionPreview !== null);
  const scene = useEditorStore(s => s.scene);

  const selectedElements = useMemo(
    () => selectedIds.map(id => elements.find(el => el.key === id)).filter((el): el is NonNullable<typeof el> => Boolean(el)),
    [selectedIds, elements],
  );

  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTabType>("palette");
  const [activeTab, setActiveTab] = useState<TabType>("editor");

  // Ширина боковых панелей — настраивается перетаскиванием края (см. handleResizeStart).
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [resizingSide, setResizingSide] = useState<"left" | "right" | null>(null);
  /** Корневой узел — на нём живут CSS-переменные раскладки (см. handleResizeStart). */
  const rootRef = useRef<HTMLDivElement>(null);

  // Восстанавливаем раскладку после монтирования (localStorage недоступен на сервере,
  // поэтому не читаем его в useState-инициализаторе — это дало бы рассинхронизацию с SSR-разметкой).
  // Синхронный setState здесь оправдан: это единственный способ безопасно прочитать
  // браузерный API после монтирования, а не «выводимое» из пропсов состояние.
  useEffect(() => {
    const saved = readLayout();

    if (Number.isFinite(saved.leftWidth) && saved.leftWidth! > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftWidth(clamp(saved.leftWidth!, LEFT_COLLAPSE, LEFT_MAX));
    }
    if (Number.isFinite(saved.rightWidth) && saved.rightWidth! > 0) {
      setRightWidth(clamp(saved.rightWidth!, RIGHT_COLLAPSE, RIGHT_MAX));
    }
    if (typeof saved.leftVisible === "boolean") setLeftVisible(saved.leftVisible);
    if (typeof saved.rightVisible === "boolean") setRightVisible(saved.rightVisible);
    if (LEFT_TABS.includes(saved.leftTab as LeftTabType)) setLeftTab(saved.leftTab!);
    if (MAIN_TABS.includes(saved.activeTab as TabType)) setActiveTab(saved.activeTab!);
  }, []);

  // Одна отложенная запись вместо синхронной на каждое изменение ширины.
  useEffect(() => {
    const id = setTimeout(() => {
      const layout: PersistedLayout = {
        leftWidth,
        rightWidth,
        leftVisible,
        rightVisible,
        leftTab,
        activeTab,
      };
      try {
        localStorage.setItem(LS_LAYOUT, JSON.stringify(layout));
      } catch {
        // Квота/приватный режим — раскладка не сохранится, работать это не мешает.
      }
    }, SAVE_DELAY);

    return () => clearTimeout(id);
  }, [leftWidth, rightWidth, leftVisible, rightVisible, leftTab, activeTab]);

  /**
   * Перетаскивание края панели: ширина следует за курсором, а при уходе ниже
   * порога панель схлопывается (тот же жест, что и «Свернуть», плюс сброс к
   * дефолтной ширине).
   *
   * Во время жеста ширина живёт в CSS-переменных корневого узла, и React в нём
   * не участвует. Раньше каждый `pointermove` вызывал `setState` — то есть сотни
   * ре-рендеров всего редактора (палитра, слои, свойства, тулбар и холст) на
   * один жест. В стор состояние уходит один раз, на отпускании.
   */
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, side: "left" | "right") => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    setResizingSide(side);

    const [collapseAt, maxWidth, defaultWidth] = side === "left"
      ? [LEFT_COLLAPSE, LEFT_MAX, LEFT_DEFAULT]
      : [RIGHT_COLLAPSE, RIGHT_MAX, RIGHT_DEFAULT];

    // Итог жеста: применяется к CSS-переменным на каждое движение и один раз
    // уходит в состояние React на отпускании.
    let width = startWidth;
    let visible = true;

    const paint = () => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty(`--ws-${side}-w`, `${width}px`);
      root.style.setProperty(`--ws-${side}-m`, visible ? `${width}px` : "0px");
    };

    const onMove = (ev: PointerEvent) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const raw = startWidth + delta;
      if (raw < collapseAt) {
        visible = false;
        width = defaultWidth;
      } else {
        visible = true;
        width = Math.min(raw, maxWidth);
      }
      paint();
    };

    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      // pointercancel: система может отобрать указатель (жест браузера, отключение
      // устройства). Без этого обработчика панель залипала в режиме перетаскивания.
      handle.removeEventListener("pointercancel", onUp);
      setResizingSide(null);
      if (side === "left") {
        setLeftWidth(width);
        setLeftVisible(visible);
      } else {
        setRightWidth(width);
        setRightVisible(visible);
      }
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  /** Изменение ширины панели с клавиатуры (ручка — role="separator"). */
  const handleResizeKey = (e: React.KeyboardEvent, side: "left" | "right") => {
    const STEP = 16;
    const width = side === "left" ? leftWidth : rightWidth;
    const [min, max] = side === "left" ? [LEFT_COLLAPSE, LEFT_MAX] : [RIGHT_COLLAPSE, RIGHT_MAX];
    const setWidth = side === "left" ? setLeftWidth : setRightWidth;
    const setVisible = side === "left" ? setLeftVisible : setRightVisible;

    // Для левой панели «шире» — это вправо, для правой — влево.
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";

    let next: number | null = null;
    if (e.key === grow) next = Math.min(width + STEP, max);
    else if (e.key === shrink) next = width - STEP;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setVisible(false);
      return;
    }

    if (next === null) return;
    e.preventDefault();
    if (next < min) {
      setVisible(false);
      setWidth(side === "left" ? LEFT_DEFAULT : RIGHT_DEFAULT);
    } else {
      setWidth(next);
    }
  };

  const activeTabKey = activeTab === "recipes"
    ? "recipes"
    : (scene ? `scene:${scene.id}` : "editor");

  /** Активирует вкладку по ключу — общий вход для клика и стрелок. */
  const activateTab = (key: string) => {
    if (key === "recipes") { setActiveTab("recipes"); return; }
    if (key === "editor") { setActiveTab("editor"); return; }

    const id = Number(key.slice("scene:".length));
    if (!Number.isFinite(id)) return;
    // Своя схема уже открыта — просто показываем холст.
    if (scene?.id === id) { setActiveTab("editor"); return; }
    // Чужая: вкладку переключаем только если переход состоялся (могли отказаться
    // из-за несохранённых правок).
    void openSceneGuarded(id).then(ok => { if (ok) setActiveTab("editor"); });
  };

  // Палитра, свойства, инструменты и Canvas показываются только во вкладке «Редактор».
  const showEditorPanels = activeTab === "editor";
  const leftShown = showEditorPanels && leftVisible;
  const rightShown = showEditorPanels && rightVisible;

  // Вкладки — настоящие вкладки: role="tablist"/"tab"/"tabpanel", aria-selected и
  // roving tabindex (одна остановка Tab на группу, дальше стрелками). Раньше это
  // был просто набор кнопок: скринридер не сообщал ни о группе, ни о том, какая
  // вкладка активна.
  const leftTabButton = (tab: LeftTabType, title: string) => (
    <button
      id={`left-tab-${tab}`}
      role="tab"
      type="button"
      aria-selected={leftTab === tab}
      aria-controls="left-panel-content"
      tabIndex={leftTab === tab ? 0 : -1}
      onClick={() => setLeftTab(tab)}
      onKeyDown={(e) => handleTabListKey(e, LEFT_TABS, leftTab, setLeftTab)}
      className={cn(
        "flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
        leftTab === tab
          ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
          : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 border-b-2 border-transparent",
      )}
    >
      {title}
    </button>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "editor":
        return <EditorPanel />;
      case "recipes":
        return <RecipesPanel />;
      default:
        return null;
    }
  };

  return (
    // 1. Главный контейнер фиксируем на весь экран. Он блокирует любой внешний скролл.
    <div
      ref={rootRef}
      // Вся геометрия панелей выражена CSS-переменными, а не пропсами с числами:
      // во время перетаскивания края обработчик пишет их прямо в стиль этого узла
      // (см. handleResizeStart), и ре-рендера React на каждый пиксель не происходит.
      // --ws-*-w — ширина панели, --ws-*-m — отступ содержимого (0 у свёрнутой панели).
      style={{
        "--ws-left-w": `${leftWidth}px`,
        "--ws-right-w": `${rightWidth}px`,
        "--ws-left-m": leftShown ? `${leftWidth}px` : "0px",
        "--ws-right-m": rightShown ? `${rightWidth}px` : "0px",
      } as React.CSSProperties}
      className="fixed inset-0 top-(--app-header-h) overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200"
    >

      {/* Центральная область (Холст). Занимает 100% места, находится под панелями */}
      <main className="absolute inset-0  flex flex-col z-canvas">
        {showEditorPanels && <ToolsPanel />}

        {/* Полоса вкладок — общий компонент с монитором (SceneTabs).
            Отступы обязательны: боковые панели — absolute z-panel поверх main (z-canvas), без
            marginLeft/Right полоса вкладок оказывается под левой панелью и не видна. */}
        <SceneTabs
          activeKey={activeTabKey}
          onActivate={activateTab}
          extraTab={RECIPES_TAB}
          fallbackTab={EDITOR_TAB}
          contentId="workspace-tab-content"
          ariaLabel="Разделы редактора"
          className="transition-[margin] duration-300 ease-in-out"
          style={{ marginLeft: "var(--ws-left-m)", marginRight: "var(--ws-right-m)" }}
        />

        {/* Содержимое вкладки: занимает всё оставшееся место.
            Для «Редактора» — Canvas между панелями; для остальных — чистый элемент вкладки. */}
        <div
          id="workspace-tab-content"
          role="tabpanel"
          aria-labelledby={`scene-tab-${activeTabKey}`}
          className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-neutral-900"
        >
          {renderTabContent()}
        </div>
      </main>


      {/* Левая панель - Абсолютная, прилипшая к левому краю */}
      <aside
        style={{width: "var(--ws-left-w)"}}
        className={`absolute left-0 top-0 bottom-0 z-panel border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md ease-in-out ${
          resizingSide === 'left' ? 'transition-none' : 'transition-transform duration-300'
        } ${
          leftShown ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full w-full flex flex-col">
          {/* Вкладки левой панели: Палитра / Слои */}
          <div
            role="tablist"
            aria-label="Левая панель"
            className="flex h-11 shrink-0 border-b border-neutral-200 dark:border-neutral-800"
          >
            {leftTabButton("palette", "Палитра")}
            {leftTabButton("layers", "Слои")}
          </div>
          <div
            id="left-panel-content"
            role="tabpanel"
            aria-labelledby={`left-tab-${leftTab}`}
            className="flex-1 overflow-y-auto"
          >
            {leftTab === "palette" ? <Palette /> : <LayersPanel />}
          </div>
        </div>

        {/* Кнопка СВЕРНУТЬ левую панель.
            aria-hidden + tabIndex={-1}, когда кнопка скрыта: `opacity-0
            pointer-events-none` убирает её только от мыши, из порядка Tab —
            нет, и клавиатура упиралась в невидимые кнопки. */}
        <button
          type="button"
          onClick={() => setLeftVisible(false)}
          aria-label="Свернуть левую панель"
          title="Свернуть левую панель"
          aria-hidden={!leftShown}
          tabIndex={leftShown ? 0 : -1}
          className={`absolute top-[50%] -right-8 p-2 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-opacity ${
            leftShown ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft size={24} />
        </button>

        {/* Кнопка РАЗВЕРНУТЬ левую панель (висит снаружи) */}
        <button
          type="button"
          onClick={() => setLeftVisible(true)}
          aria-label="Развернуть левую панель"
          title="Развернуть левую панель"
          aria-hidden={leftVisible || !showEditorPanels}
          tabIndex={!leftVisible && showEditorPanels ? 0 : -1}
          className={`absolute top-4 -right-12 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-r-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-xl transition-opacity ${
            !leftVisible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PanelLeft size={20} />
        </button>

        {leftShown && (
          // Ручка — separator с клавиатурой: стрелки меняют ширину на 16px,
          // Home/End — минимум/максимум, Enter сворачивает панель.
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ширина левой панели"
            aria-valuenow={leftWidth}
            aria-valuemin={LEFT_COLLAPSE}
            aria-valuemax={LEFT_MAX}
            tabIndex={0}
            onPointerDown={(e) => handleResizeStart(e, "left")}
            onKeyDown={(e) => handleResizeKey(e, "left")}
            className="absolute top-0 bottom-0 right-0 -mr-1.5 w-3 cursor-col-resize z-panel-handle group/handle"
          >
            <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-blue-500/50 group-focus/handle:bg-blue-500 transition-colors" />
          </div>
        )}
      </aside>

      {/* Правая панель - Абсолютная, прилипшая к правому краю */}
      <aside
        style={{width: "var(--ws-right-w)"}}
        className={`absolute right-0 top-0 bottom-0 z-panel border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md ease-in-out ${
          resizingSide === 'right' ? 'transition-none' : 'transition-transform duration-300'
        } ${
          rightShown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full w-full overflow-y-auto">
          {isVersionPreview ? (
            /* Холст в режиме просмотра readOnly, но выделить элемент можно из «Слоёв»,
               а панель свойств пишет в стор напрямую. Правки ушли бы в СТАРУЮ версию и
               молча пропали при выходе (стеш восстанавливает исходное состояние). */
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                Просмотр версии — свойства доступны только для чтения.
                <br />
                Выйдите из просмотра, чтобы редактировать схему.
              </div>
            </div>
          ) : selectedElement && selectedIds.length === 1 ? (
            <PropertiesPanel element={selectedElement} />
          ) : selectedElements.length > 1 ? (
            <MultiPropertiesPanel elements={selectedElements} />
          ) : (
            // Ничего не выделено — показываем свойства самой сцены (размер листа).
            // Подсказка «выберите элемент» переехала в низ этой же панели.
            <ScenePropertiesPanel />
          )}
        </div>

        {/* Кнопка СВЕРНУТЬ правую панель */}
        <button
          type="button"
          onClick={() => setRightVisible(false)}
          aria-label="Свернуть панель свойств"
          title="Свернуть панель свойств"
          aria-hidden={!rightShown}
          tabIndex={rightShown ? 0 : -1}
          className={`absolute top-[50%] -left-8 p-1 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-opacity ${
            rightShown ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight size={24} />
        </button>

        {/* Кнопка РАЗВЕРНУТЬ правую панель */}
        <button
          type="button"
          onClick={() => setRightVisible(true)}
          aria-label="Развернуть панель свойств"
          title="Развернуть панель свойств"
          aria-hidden={rightVisible || !showEditorPanels}
          tabIndex={!rightVisible && showEditorPanels ? 0 : -1}
          className={`absolute top-4 -left-12 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-l-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 shadow-xl transition-opacity ${
            !rightVisible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PanelRight size={18} />
        </button>

        {/* Ручка перетаскивания: меняет ширину, а при уходе за порог — сворачивает панель */}
        {rightShown && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ширина панели свойств"
            aria-valuenow={rightWidth}
            aria-valuemin={RIGHT_COLLAPSE}
            aria-valuemax={RIGHT_MAX}
            tabIndex={0}
            onPointerDown={(e) => handleResizeStart(e, "right")}
            onKeyDown={(e) => handleResizeKey(e, "right")}
            className="absolute top-0 bottom-0 left-0 -ml-1.5 w-3 cursor-col-resize z-panel-handle group/handle"
          >
            <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-blue-500/50 group-focus/handle:bg-blue-500 transition-colors" />
          </div>
        )}
      </aside>

    </div>
  );
}

