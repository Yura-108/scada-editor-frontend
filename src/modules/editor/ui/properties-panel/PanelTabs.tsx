"use client";

import {tabButtonClasses} from "./panelClasses";

export type TabType = "visual" | "states" | "properties" | "scripts" | "bindings" | "events";

// Таблице вкладка «Свойства» нужна наравне со всеми: её теговые свойства висят на
// ней целиком, а ячейки лишь ссылаются на них привязками. Прежде свойства
// таблицы заводились отдельной вкладкой «Строки» — она ушла.
const TABS: {id: TabType; label: string}[] = [
  {id: "visual", label: "Визуал"},
  {id: "states", label: "Состояния"},
  {id: "properties", label: "Свойства"},
  {id: "scripts", label: "Скрипты"},
  {id: "bindings", label: "Привязки"},
  {id: "events", label: "События"},
];

export function PanelTabs({activeTab, onChange}: {activeTab: TabType; onChange: (tab: TabType) => void}) {
  return (
    <div className="shrink-0 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-neutral-800">
      <div className="grid grid-rows-2 grid-cols-2 gap-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={tabButtonClasses(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
