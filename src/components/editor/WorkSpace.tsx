import {ChevronLeft, ChevronRight, PanelLeft, PanelRight} from "lucide-react";
import {PropertiesPanel} from "@/components/editor/PropertiesPanel";
import {MultiPropertiesPanel} from "@/components/editor/MultiPropertiesPanel";
import {LayersPanel} from "@/components/editor/LayersPanel";
import {useEditorStore} from "@/store/useEditorStore";
import React, {useMemo, useState, useRef, useEffect} from "react";
import Palette from "./Palette";
import ToolsPanel from "@/components/editor/ToolsPanel";
import {cn} from "@/lib/utils";
import {EditorPanel} from "@/components/editor/panels/EditorPanel";
import {RecipesPanel} from "@/components/editor/panels/RecipesPanel";
import {LineParametersPanel} from "@/components/editor/panels/LineParametersPanel";
import {StationParametersPanel} from "@/components/editor/panels/StationParametersPanel";
import {PIDControllerPanel} from "@/components/editor/panels/PIDControllerPanel";
import {LineBindingPanel} from "@/components/editor/panels/LineBindingPanel";
import {SignalsPanel} from "@/components/editor/panels/SignalsPanel";
import {AlarmLogPanel} from "@/components/editor/panels/AlarmLogPanel";
import {ReportsPanel} from "@/components/editor/panels/ReportsPanel";
import {HelpPanel} from "@/components/editor/panels/HelpPanel";

type TabType = "editor" | "recipes" | "lineParams" | "stationParams" | "pidController" | "lineBinding" | "signals" | "alarmLog" | "reports" | "help";

// Ширины боковых панелей: дефолт/максимум/порог, ниже которого перетаскивание края схлопывает панель.
const LEFT_DEFAULT = 288, LEFT_MAX = 480, LEFT_COLLAPSE = 160;
const RIGHT_DEFAULT = 320, RIGHT_MAX = 520, RIGHT_COLLAPSE = 180;
const LS_LEFT_WIDTH = "scada-editor:leftPanelWidth";
const LS_RIGHT_WIDTH = "scada-editor:rightPanelWidth";

export default function WorkSpace() {
  // Точечные селекторы вместо подписки на весь стор: иначе каждый тик пана/зума
  // ре-рендерил WorkSpace и каскадом весь Canvas со всеми фигурами.
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectedElement = useEditorStore(s => s.elements.find(el => el.key === s.selectedIds[0]));
  const elements = useEditorStore(s => s.elements);

  const selectedElements = useMemo(
    () => selectedIds.map(id => elements.find(el => el.key === id)).filter((el): el is NonNullable<typeof el> => Boolean(el)),
    [selectedIds, elements],
  );

  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [leftTab, setLeftTab] = useState<"palette" | "layers">("palette");
  const [activeTab, setActiveTab] = useState<TabType>("editor");
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Ширина боковых панелей — настраивается перетаскиванием края (см. handleResizeStart).
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);
  const [resizingSide, setResizingSide] = useState<"left" | "right" | null>(null);

  // Восстанавливаем сохранённую ширину после монтирования (localStorage недоступен на сервере,
  // поэтому не читаем его в useState-инициализаторе — это дало бы рассинхронизацию с SSR-разметкой).
  // Синхронный setState здесь оправдан: это единственный способ безопасно прочитать
  // браузерный API после монтирования, а не «выводимое» из пропсов состояние.
  useEffect(() => {
    const savedLeft = Number(localStorage.getItem(LS_LEFT_WIDTH));
    if (Number.isFinite(savedLeft) && savedLeft > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftWidth(Math.min(Math.max(savedLeft, LEFT_COLLAPSE), LEFT_MAX));
    }
    const savedRight = Number(localStorage.getItem(LS_RIGHT_WIDTH));
    if (Number.isFinite(savedRight) && savedRight > 0) {
      setRightWidth(Math.min(Math.max(savedRight, RIGHT_COLLAPSE), RIGHT_MAX));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_LEFT_WIDTH, String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem(LS_RIGHT_WIDTH, String(rightWidth));
  }, [rightWidth]);

  // Перетаскивание края панели: ширина следует за курсором, а при уходе ниже порога
  // панель схлопывается (тот же жест, что и «Свернуть», плюс сброс к дефолтной ширине).
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, side: "left" | "right") => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    setResizingSide(side);

    const onMove = (ev: PointerEvent) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const raw = startWidth + delta;
      if (side === "left") {
        if (raw < LEFT_COLLAPSE) {
          setLeftVisible(false);
          setLeftWidth(LEFT_DEFAULT);
        } else {
          setLeftVisible(true);
          setLeftWidth(Math.min(raw, LEFT_MAX));
        }
      } else {
        if (raw < RIGHT_COLLAPSE) {
          setRightVisible(false);
          setRightWidth(RIGHT_DEFAULT);
        } else {
          setRightVisible(true);
          setRightWidth(Math.min(raw, RIGHT_MAX));
        }
      }
    };
    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      setResizingSide(null);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  // Палитра, свойства, инструменты и Canvas показываются только во вкладке «Редактор».
  const showEditorPanels = activeTab === "editor";
  const leftShown = showEditorPanels && leftVisible;
  const rightShown = showEditorPanels && rightVisible;

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const leftTabButton = (tab: "palette" | "layers", title: string) => (
    <button
      onClick={() => setLeftTab(tab)}
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

  const tabButton = (tab: TabType, title: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn(
        "px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap",
        activeTab === tab
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
        return <EditorPanel rightInset={rightShown ? rightWidth : 0} />;
      case "recipes":
        return <RecipesPanel />;
      case "lineParams":
        return <LineParametersPanel />;
      case "stationParams":
        return <StationParametersPanel />;
      case "pidController":
        return <PIDControllerPanel />;
      case "lineBinding":
        return <LineBindingPanel />;
      case "signals":
        return <SignalsPanel />;
      case "alarmLog":
        return <AlarmLogPanel />;
      case "reports":
        return <ReportsPanel />;
      case "help":
        return <HelpPanel />;
      default:
        return null;
    }
  };

  return (
    // 1. Главный контейнер фиксируем на весь экран. Он блокирует любой внешний скролл.
    <div className="fixed inset-0 top-16 overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200">

      {/* Центральная область (Холст). Занимает 100% места, находится под панелями (z-0) */}
      <main className="absolute inset-0  flex flex-col z-0">
        {showEditorPanels && (
          <ToolsPanel
            leftOffset={leftShown ? leftWidth : 0}
            rightOffset={rightShown ? rightWidth : 0}
          />
        )}

        {/* Полоса вкладок: под header, между боковыми панелями. Не влезающие вкладки
            скрыты (overflow скрыт), переключение — стрелками. */}
        {/*<div*/}
        {/*  style={{*/}
        {/*    marginLeft: leftShown ? LEFT_ASIDE_WIDTH : 0,*/}
        {/*    marginRight: rightShown ? RIGHT_ASIDE_WIDTH : 0,*/}
        {/*  }}*/}
        {/*  className="h-11 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md relative z-10 flex items-center transition-[margin] duration-300 ease-in-out"*/}
        {/*>*/}
        {/*  /!* Кнопка прокрутки влево *!/*/}
        {/*  <button*/}
        {/*    onClick={() => scrollTabs('left')}*/}
        {/*    className="shrink-0 p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"*/}
        {/*  >*/}
        {/*    <ChevronLeft size={20} />*/}
        {/*  </button>*/}

        {/*  /!* Контейнер вкладок с прокруткой (скролл-бар скрыт) *!/*/}
        {/*  <div*/}
        {/*    ref={tabsContainerRef}*/}
        {/*    className="flex-1 overflow-x-auto scrollbar-hide"*/}
        {/*  >*/}
        {/*    <div className="flex w-max">*/}
        {/*      {tabButton("editor", "Редактор")}*/}
        {/*      {tabButton("recipes", "Рецепты")}*/}
        {/*      {tabButton("lineParams", "Параметры линии")}*/}
        {/*      {tabButton("stationParams", "Параметры станции")}*/}
        {/*      {tabButton("pidController", "ПИД регулятор")}*/}
        {/*      {tabButton("lineBinding", "Обвязка линии")}*/}
        {/*      {tabButton("signals", "Сигналы")}*/}
        {/*      {tabButton("alarmLog", "Журнал аварий")}*/}
        {/*      {tabButton("reports", "Отчеты")}*/}
        {/*      {tabButton("help", "Справка")}*/}
        {/*    </div>*/}
        {/*  </div>*/}

        {/*  /!* Кнопка прокрутки вправо *!/*/}
        {/*  <button*/}
        {/*    onClick={() => scrollTabs('right')}*/}
        {/*    className="shrink-0 p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"*/}
        {/*  >*/}
        {/*    <ChevronRight size={20} />*/}
        {/*  </button>*/}
        {/*</div>*/}

        {/* Минимальная полоса вкладок: пока реально готовы только «Редактор» и «Рецепты» —
            остальные 8 вкладок выше остаются заглушками и закомментированы намеренно.
            Отступы обязательны: боковые панели — absolute z-40 поверх main (z-0), без
            marginLeft/Right полоса вкладок оказывается под левой панелью и не видна. */}
        <div
          style={{
            marginLeft: leftShown ? leftWidth : 0,
            marginRight: rightShown ? rightWidth : 0,
          }}
          className="h-11 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md flex items-center px-4 gap-2 transition-[margin] duration-300 ease-in-out"
        >
          {tabButton("editor", "Редактор")}
          {tabButton("recipes", "Рецепты")}
        </div>

        {/* Содержимое вкладки: занимает всё оставшееся место.
            Для «Редактора» — Canvas между панелями; для остальных — чистый элемент вкладки. */}
        <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-neutral-900">
          {renderTabContent()}
        </div>
      </main>


      {/* Левая панель - Абсолютная, прилипшая к левому краю */}
      <aside
        style={{width: leftWidth}}
        className={`absolute left-0 top-0 bottom-0 z-40 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md ease-in-out ${
          resizingSide === 'left' ? 'transition-none' : 'transition-transform duration-300'
        } ${
          leftShown ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full w-full flex flex-col">
          {/* Вкладки левой панели: Палитра / Слои */}
          <div className="flex h-11 shrink-0 border-b border-neutral-200 dark:border-neutral-800">
            {leftTabButton("palette", "Палитра")}
            {leftTabButton("layers", "Слои")}
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === "palette" ? <Palette /> : <LayersPanel />}
          </div>
        </div>

        {/* Кнопка СВЕРНУТЬ левую панель */}
        <button
          onClick={() => setLeftVisible(false)}
          className={`absolute top-[50%] -right-8 p-2 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 transition-opacity ${
            leftShown ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft size={24} />
        </button>

        {/* Кнопка РАЗВЕРНУТЬ левую панель (висит снаружи) */}
        <button
          onClick={() => setLeftVisible(true)}
          className={`absolute top-4 -right-12 p-2 bg-white border border-neutral-200 dark:border-neutral-800 rounded-r-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:bg-neutral-800 shadow-xl transition-opacity ${
            !leftVisible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PanelLeft size={20} />
        </button>

        {leftShown && (
          <div
            onPointerDown={(e) => handleResizeStart(e, "left")}
            className="absolute top-0 bottom-0 right-0 -mr-1.5 w-3 cursor-col-resize z-50 group/handle"
          >
            <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-blue-500/50 transition-colors" />
          </div>
        )}
      </aside>

      {/* Правая панель - Абсолютная, прилипшая к правому краю */}
      <aside
        style={{width: rightWidth}}
        className={`absolute right-0 top-0 bottom-0 z-40 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 backdrop-blur-md ease-in-out ${
          resizingSide === 'right' ? 'transition-none' : 'transition-transform duration-300'
        } ${
          rightShown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full w-full overflow-y-auto">
          {selectedElement && selectedIds.length === 1 ? (
            <PropertiesPanel element={selectedElement} />
          ) : selectedElements.length > 1 ? (
            <MultiPropertiesPanel elements={selectedElements} />
          ) : (
            <div className="h-full flex flex-col items-center text-center p-6">
              <div className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Выберите элемент</div>
            </div>
          )}
        </div>

        {/* Кнопка СВЕРНУТЬ правую панель */}
        <button
          onClick={() => setRightVisible(false)}
          className={`absolute top-[50%] -left-8 p-1 text-neutral-600 dark:text-neutral-400 hover:text-gray-900 dark:text-white transition-opacity ${
            rightShown ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight size={24} />
        </button>

        {/* Кнопка РАЗВЕРНУТЬ правую панель */}
        <button
          onClick={() => setRightVisible(true)}
          className={`absolute top-4 -left-12 p-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-l-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:bg-neutral-800 shadow-xl transition-opacity ${
            !rightVisible && showEditorPanels ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <PanelRight size={18} />
        </button>

        {/* Ручка перетаскивания: меняет ширину, а при уходе за порог — сворачивает панель */}
        {rightShown && (
          <div
            onPointerDown={(e) => handleResizeStart(e, "right")}
            className="absolute top-0 bottom-0 left-0 -ml-1.5 w-3 cursor-col-resize z-50 group/handle"
          >
            <div className="mx-auto h-full w-px bg-transparent group-hover/handle:bg-blue-500/50 transition-colors" />
          </div>
        )}
      </aside>

    </div>
  );
}

