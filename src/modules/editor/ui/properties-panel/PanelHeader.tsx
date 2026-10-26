"use client";

import {Layers} from "lucide-react";
import {DiagramElement} from "@/types/editorElement.type";
import {elementTypeLabel} from "@/constants/propertiesPanel";
import {useEditorStore} from "../../model/editorStore";

/** Заголовок панели и плашка режима «Править все состояния». */
export function PanelHeader({element}: {element: DiagramElement}) {
  const editAllStates = useEditorStore(s => s.editAllStates);
  const setEditAllStates = useEditorStore(s => s.setEditAllStates);

  return (
    <>
      {/* Header */}
      <div className="shrink-0 p-4 pb-3 border-b border-gray-200 dark:border-neutral-800">
        {/* Единый вид заголовка панели (как в «Слоях»): раньше здесь был
            h3 text-base «Progress_bar Properties», в LayersPanel — h3 text-xs
            uppercase, а в RecipesPanel — h1 text-2xl. */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Свойства: {elementTypeLabel(element.type)}
        </h3>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 font-mono">
          ID: {element.key.slice(0, 8)}...
        </p>
      </div>

      {/* Режим правки всех состояний виден на ЛЮБОЙ вкладке: иначе про него забывают,
          и правка «только для Аварии» молча растекается по всем состояниям — ровно та
          ошибка, от которой режим и должен спасать. */}
      {editAllStates && (
        <div className="shrink-0 mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2">
          <Layers size={14} className="shrink-0 text-amber-600 dark:text-amber-400"/>
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Правка идёт во все состояния
          </span>
          <button
            type="button"
            onClick={() => setEditAllStates(false)}
            className="ml-auto text-xs text-amber-700 hover:underline dark:text-amber-300"
          >
            Выключить
          </button>
        </div>
      )}
    </>
  );
}
