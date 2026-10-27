import React, {useRef} from "react";
import {SceneTabs} from "../scene-tabs/SceneTabs";
import {EditorPanel} from "./EditorPanel";
import {RecipesPanel} from "../recipes/RecipesPanel";
import {useCurrentProjectGrant} from "@/core/access";
import {ToolsPanel} from "../tools-panel";
import {usePanelResize} from "./hooks/usePanelResize";
import {usePersistedLayout} from "./hooks/usePersistedLayout";
import {useWorkspaceTabs} from "./hooks/useWorkspaceTabs";
import {LeftPanel} from "./LeftPanel";
import {RightPanel} from "./RightPanel";

// Вкладки-не-схемы для SceneTabs. На уровне модуля, а не литералом в JSX: новый объект
// на каждый рендер сбрасывал бы мемоизацию ряда вкладок внутри компонента.
const RECIPES_TAB = {key: "recipes", label: "Рецепты"} as const;
const EDITOR_TAB = {key: "editor", label: "Редактор"} as const;

export function WorkSpace() {
  // Закрепления — настройка проекта: без права правки вкладки только видны.
  const canWrite = useCurrentProjectGrant().edit;
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


      <LeftPanel
        width={leftWidth}
        shown={leftShown}
        visible={leftVisible}
        showEditorPanels={showEditorPanels}
        resizing={resizingSide === "left"}
        leftTab={leftTab}
        setLeftTab={setLeftTab}
        setVisible={setLeftVisible}
        onResizeStart={(e) => handleResizeStart(e, "left")}
        onResizeKey={(e) => handleResizeKey(e, "left")}
      />

      <RightPanel
        width={rightWidth}
        shown={rightShown}
        visible={rightVisible}
        showEditorPanels={showEditorPanels}
        resizing={resizingSide === "right"}
        setVisible={setRightVisible}
        onResizeStart={(e) => handleResizeStart(e, "right")}
        onResizeKey={(e) => handleResizeKey(e, "right")}
      />

    </div>
  );
}

