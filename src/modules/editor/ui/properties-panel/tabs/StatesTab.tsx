"use client";

import {Pencil, Plus, Trash2} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {DiagramElement} from "@/types/editorElement.type";
import {StateSelect} from "../StateSelect";
import {EditAllStatesToggle} from "../EditAllStatesToggle";
import {useStateActions} from "../hooks/useStateActions";
import {baseAddButtonClasses} from "../panelClasses";

/** Вкладка «Состояния»: текущее состояние, список, добавление, переименование, удаление. */
export function StatesTab({element}: {element: DiagramElement}) {
  const {addComponentState, removeComponentState, renameComponentState} = useStateActions(element);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Состояние:
        </h4>
        <StateSelect elementKey={element.key} states={element.states}/>
      </div>

      <EditAllStatesToggle withHint/>

      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Список состояний
        </h4>
        <div className="space-y-1.5">
          {element.states.map(state => (
            <div
              key={state.id}
              className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60 px-3 py-1.5"
            >
              <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                {state.name}
              </span>
              {state.isDefault && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  по умолчанию
                </span>
              )}
              {/* ml-auto на общей обёртке, а не на корзине: у состояния по
                  умолчанию корзины нет, и карандаш прижался бы к имени. */}
              <div className="ml-auto flex items-center gap-0.5">
                <IconButton
                  icon={Pencil}
                  size="xs"
                  title="Переименовать состояние"
                  label={`Переименовать «${state.name}»`}
                  onClick={() => renameComponentState(state.name)}
                />
                {!state.isDefault && (
                  <IconButton
                    icon={Trash2}
                    size="xs"
                    variant="danger"
                    title="Удалить состояние"
                    label={`Удалить «${state.name}»`}
                    onClick={() => removeComponentState(state.name)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        className={baseAddButtonClasses}
        onClick={() => void addComponentState()}
      >
        <Plus size={18}/>
        Добавить состояние
      </button>
    </div>
  );
}
