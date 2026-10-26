"use client";

import React, {useState, useMemo} from "react";
import {DiagramElement} from "@/types/editorElement.type";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {BindingsTab} from "@/components/editor/bindings/BindingsTab";
import {EventsTab} from "@/components/editor/events/EventsTab";
import {useEditorStore} from "../../model/editorStore";
import {PanelHeader} from "./PanelHeader";
import {PanelTabs, type TabType} from "./PanelTabs";
import {baseAddButtonClasses} from "./panelClasses";
import {PropertiesTab} from "./tabs/PropertiesTab";
import {ScriptsTab} from "./tabs/ScriptsTab";
import {StatesTab} from "./tabs/StatesTab";
import {VisualTab} from "./tabs/VisualTab";

interface PropertiesPanelProps {
  element: DiagramElement | null;
}

/**
 * Панель свойств одного выбранного элемента: заголовок, вкладки и их содержимое.
 *
 * Вкладка живёт здесь и переживает выбор другого элемента, а содержимое пересоздаётся по
 * ключу элемента — локальное состояние вкладок (порядок свойств при перетаскивании,
 * выбор тега для ячейки) к новому элементу не переезжает.
 */
export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({element}) => {
  const [activeTab, setActiveTab] = useState<TabType>("visual");
  // Точечные селекторы: подписка на весь стор ре-рендерила панель на каждый тик пана/зума.
  const currentComponentStateByElementKey = useEditorStore(s => s.currentComponentStateByElementKey);

  const currentComponentStateId = element
    ? (currentComponentStateByElementKey[element.key] ?? element.states.find(s => s.isDefault)?.id ?? element.states[0]?.id)
    : undefined;

  // `getRenderedElement` читает активное состояние из стора нереактивно, поэтому оно —
  // в зависимостях: сменили состояние — поля показывают его значения.
  const renderedElement = useMemo(() => element ? getRenderedElement(element) : null, [element, currentComponentStateId]);
  const renderedElementValues = useMemo(
    () => renderedElement ? (renderedElement as unknown as Record<string, unknown>) : {},
    [renderedElement]
  );

  // Прежде здесь стоял эффект, уводивший таблицу с вкладки «Свойства» на «Визуал»: у неё
  // была отдельная вкладка «Строки». «Строки» давно убрали (см. комментарий у кнопок вкладок),
  // а эффект остался и мешал — в том числе поправить «Тип значения» строки рецепта, который
  // уезжает в json набора.

  // Пустое состояние живёт в WorkSpace: панель свойств рендерится только когда
  // выбран ровно один элемент, поэтому эта ветка была недостижима — два разных
  // текста на одно и то же условие.
  if (!element) return null;

  return (
    <div key={element.key} className="h-full flex flex-col bg-white/70 dark:bg-neutral-950/70 backdrop-blur-sm border-l border-gray-200 dark:border-neutral-800 overflow-hidden">
      <PanelHeader element={element}/>

      <PanelTabs activeTab={activeTab} onChange={setActiveTab}/>

      {/* Контент вкладок */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5 text-sm">

        {/* Визуальные параметры */}
        {activeTab === "visual" && <VisualTab element={element} values={renderedElementValues}/>}

        {/* Состояния */}
        {activeTab === "states" && <StatesTab element={element}/>}

        {/* Свойства */}
        {activeTab === "properties" && <PropertiesTab element={element}/>}

        {/* Скрипты */}
        {activeTab === "scripts" && <ScriptsTab element={element}/>}

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
