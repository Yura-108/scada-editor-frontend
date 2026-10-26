import {ChevronLeft, ChevronRight, PanelLeft, PanelRight} from "lucide-react";
import {MultiPropertiesPanel} from "@/components/editor/MultiPropertiesPanel";
import {ScenePropertiesPanel} from "@/components/editor/ScenePropertiesPanel";
import {LayersPanel} from "@/components/editor/LayersPanel";
import {useEditorStore} from "../../model/editorStore";
import {PropertiesPanel} from "../properties-panel";
import {ToolsPanel} from "../tools-panel";
import {SceneTabs} from "@/components/editor/SceneTabs";
import {useCurrentProjectGrant} from "@/lib/access/projectAccess";
import {handleTabListKey} from "@/lib/editor/tabListKeys";
import React, {useMemo, useRef} from "react";
import {LEFT_COLLAPSE, LEFT_MAX, LEFT_TABS, type LeftTabType, RIGHT_COLLAPSE, RIGHT_MAX} from "./lib/workspaceLayout";
import {usePanelResize} from "./hooks/usePanelResize";
import {usePersistedLayout} from "./hooks/usePersistedLayout";
import {useWorkspaceTabs} from "./hooks/useWorkspaceTabs";
import Palette from "@/components/editor/Palette";
import {cn} from "@/shared/lib/cn";
import {EditorPanel} from "@/components/editor/panels/EditorPanel";
import {RecipesPanel} from "@/components/editor/panels/RecipesPanel";

// Вкладки-не-схемы для SceneTabs. На уровне модуля, а не литералом в JSX: новый объект
// на каждый рендер сбрасывал бы мемоизацию ряда вкладок внутри компонента.
const RECIPES_TAB = {key: "recipes", label: "Рецепты"} as const;
const EDITOR_TAB = {key: "editor", label: "Редактор"} as const;

export function WorkSpace() {
  // Закрепления — настройка проекта: без права правки вкладки только видны.
  const canWrite = useCurrentProjectGrant().edit;
  // Точечные селекторы вместо подписки на весь стор: иначе каждый тик пана/зума
  // ре-рендерил WorkSpace и каскадом весь Canvas со всеми фигурами.
  const selectedIds = useEditorStore(s => s.selectedIds);
  const selectedElement = useEditorStore(s => s.elements.find(el => el.key === s.selectedIds[0]));
  const elements = useEditorStore(s => s.elements);
  const isVersionPreview = useEditorStore(s => s.versionPreview !== null);

  const selectedElements = useMemo(
    () => selectedIds.map(id => elements.find(el => el.key === id)).filter((el): el is NonNullable<typeof el> => Boolean(el)),
    [selectedIds, elements],
  );

  const layout = usePersistedLayout();
  const {leftWidth, rightWidth, leftVisible, setLeftVisible, rightVisible, setRightVisible, leftTab, setLeftTab, activeTab, setActiveTab} = layout;
  /** Корневой узел — на нём живут CSS-переменные раскладки (см. usePanelResize). */
  const rootRef = useRef<HTMLDivElement>(null);
  const {resizingSide, handleResizeStart, handleResizeKey} = usePanelResize(rootRef, layout);
  const {activeTabKey, activateTab} = useWorkspaceTabs(activeTab, setActiveTab);

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
          editable={canWrite}
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

