"use client";

import {Tabs, type TabItem} from "@/shared/ui/Tabs";

export type TabType = "visual" | "states" | "properties" | "scripts" | "bindings" | "events";

/** Id полосы вкладок: панель под ней связывается через `tabPanelProps(PANEL_TABS_ID, …)`. */
export const PANEL_TABS_ID = "properties-panel";

// Таблице вкладка «Свойства» нужна наравне со всеми: её теговые свойства висят на
// ней целиком, а ячейки лишь ссылаются на них привязками. Прежде свойства
// таблицы заводились отдельной вкладкой «Строки» — она ушла.
const TABS: TabItem<TabType>[] = [
  {value: "visual", label: "Визуал"},
  {value: "states", label: "Состояния"},
  {value: "properties", label: "Свойства"},
  {value: "scripts", label: "Скрипты"},
  {value: "bindings", label: "Привязки"},
  {value: "events", label: "События"},
];

export function PanelTabs({activeTab, onChange}: {activeTab: TabType; onChange: (tab: TabType) => void}) {
  return (
    <div className="shrink-0 px-4 pt-3 pb-2 border-b">
      <Tabs
        id={PANEL_TABS_ID}
        aria-label="Вкладки панели свойств"
        value={activeTab}
        onValueChange={onChange}
        items={TABS}
        stretch
        className="grid grid-cols-2 gap-2"
      />
    </div>
  );
}
