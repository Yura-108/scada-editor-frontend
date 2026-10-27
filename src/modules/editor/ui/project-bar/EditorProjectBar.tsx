"use client";

import {useCurrentProjectGrant} from "@/lib/access/projectAccess";
import {ProjectPicker} from "./ProjectPicker";
import {ScenePicker} from "./ScenePicker";
import {SceneStatus} from "./SceneStatus";

/**
 * Полоса раздела над редактором — та же, что в мониторе, «Автоматизации» и «Данных»:
 * подпись, проект, схема, справа статус. Действия с проектом и схемой — в строках списков.
 */
export function EditorProjectBar() {
  const canWrite = useCurrentProjectGrant().edit;

  return (
    <div className="h-12 shrink-0 flex items-center gap-2 xl:gap-3 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 whitespace-nowrap overflow-x-auto">
      <span className="hidden xl:inline text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Редактор
      </span>
      <ProjectPicker />
      <ScenePicker />
      <div className="flex-1" />
      <SceneStatus canWrite={canWrite} />
    </div>
  );
}
