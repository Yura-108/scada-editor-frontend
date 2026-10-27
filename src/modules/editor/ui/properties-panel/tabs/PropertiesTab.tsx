"use client";

import {DndContext, closestCenter} from "@dnd-kit/core";
import {SortableContext, rectSortingStrategy} from "@dnd-kit/sortable";
import {AlertTriangle, Plus} from "lucide-react";
import {DiagramElement} from "@/types/editorElement.type";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {confirmDeleteProperty} from "../../../lib/confirmDeleteProperty";
import {useDeviceStore} from "@/store/useDeviceStore";
import {MonitorMenuSettingsBlock} from "../blocks/MonitorMenuSettingsBlock";
import {TrendSettingsBlock} from "../blocks/TrendSettingsBlock";
import {hasMonitorMenu} from "../../canvas/lib/buildMonitorMenu";
import {useEditorStore} from "../../../model/editorStore";
import {usePropertyOrder} from "../hooks/usePropertyOrder";
import {propertyKey} from "../lib/propertyOrder";
import {baseAddButtonClasses, baseInputClasses} from "../panelClasses";
import {SortablePropertyPill} from "../SortablePropertyPill";

const addPropertyHint =
  "Откройте раздел «База каналов» и загрузите проект — без дерева устройств не из чего выбрать тег.";

/** Вкладка «Свойства»: теговые свойства элемента, перья тренда, меню монитора. */
export function PropertiesTab({element}: {element: DiagramElement}) {
  const updateElementVisual = useEditorStore(s => s.updateElementVisual);
  // База каналов подгружена, если в дереве устройств есть узлы (глобальный стор,
  // наполняется при заходе в раздел «База каналов»). Без неё не из чего выбрать тег.
  const isChannelBaseLoaded = useDeviceStore(s => s.nodes.length > 0);
  const {sortedProperties, dndSensors, handlePropertyDragEnd} = usePropertyOrder(element);

  // Требование «сначала сохраните схему» снято: свойства едут вместе со сценой, и
  // заводить их можно элементу, которого на сервере ещё нет. Осталось единственное
  // условие — загруженная база каналов, без неё не из чего выбрать тег.
  const canAddProperty = isChannelBaseLoaded;

  return (
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
                  onClick={() => handleAddProperty(element.key, property)}
                  onDelete={() => void confirmDeleteProperty(property, element.key)}
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

      {/* Перья тренда — те же тег-свойства, что выше, плюс их оформление. */}
      {element.type === "trend" && (
        <TrendSettingsBlock
          element={element}
          onChange={(trend) => updateElementVisual(element.key, {trend})}
          inputClassName={baseInputClasses}
          addButtonClassName={baseAddButtonClasses}
          canAddPen={canAddProperty}
          addPenHint={addPropertyHint}
        />
      )}

      {/* Меню по ПКМ в мониторе есть только у элемента со свойствами-тегами или
          с действием «Добавить действие в монитор?» — у остальных настраивать нечего. */}
      {hasMonitorMenu(element) && (
        <MonitorMenuSettingsBlock
          element={element}
          onChange={(monitorMenu) => updateElementVisual(element.key, {monitorMenu})}
          inputClassName={baseInputClasses}
        />
      )}
    </div>
  );
}
