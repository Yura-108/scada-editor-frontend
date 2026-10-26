"use client";

import {Check} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {useEditorStore} from "../../model/editorStore";

/**
 * Переключатель «Править все состояния».
 *
 * Показывается на ОБЕИХ вкладках: заводят его на «Состояниях», а пользуются им на
 * «Визуале» — там правят цвет, текст и геометрию. Гонять пользователя между вкладками
 * ради галочки, которая влияет ровно на соседние поля, незачем.
 */
export function EditAllStatesToggle({withHint}: {withHint: boolean}) {
  const editAllStates = useEditorStore(s => s.editAllStates);
  const setEditAllStates = useEditorStore(s => s.setEditAllStates);

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={editAllStates}
        onClick={() => setEditAllStates(!editAllStates)}
        className={cn(
          "w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
          editAllStates
            ? "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-neutral-800/60",
        )}
      >
        <span className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          editAllStates
            ? "border-amber-500 bg-amber-500 text-white"
            : "border-gray-400 dark:border-neutral-600",
        )}>
          {editAllStates && <Check size={12}/>}
        </span>
        Править все состояния
      </button>
      {withHint && (
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-neutral-500">
          Пока включено, правки визуала пишутся во все состояния элемента сразу.
        </p>
      )}
    </div>
  );
}
