"use client";

import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";

/** Правый край полосы редактора: право просмотра и статус сохранения. Имена — в списках слева. */
export function SceneStatus({canWrite}: {canWrite: boolean}) {
  const {currentProject, scene, versionPreview, isSaving, isDirty, lastSavedAt, sceneVersion} = useEditorStore(
    useShallow(s => ({
      currentProject: s.currentProject, scene: s.scene, versionPreview: s.versionPreview,
      isSaving: s.isSaving, isDirty: s.isDirty, lastSavedAt: s.lastSavedAt, sceneVersion: s.sceneVersion,
    })),
  );

  if (!currentProject && !scene) return null;

  return (
    <div className="min-w-0 flex items-center gap-3 text-xs font-medium text-neutral-400">
      {/* Статус сохранения: автосейв тихий и раз в 10 минут, поэтому без
          этой подписи пользователь не знал, в безопасности ли его работа.
          В режиме просмотра версии статус не показываем — там говорит плашка,
          а «сохранено в …» рядом со старой версией только запутает. */}
      {currentProject && !canWrite && (
        <span
          className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400"
          title="У вас право просмотра проекта: правки остаются локальными и не сохраняются"
        >
          только просмотр
        </span>
      )}
      {scene && !versionPreview && canWrite && (
        <span className="shrink-0 whitespace-nowrap">
          {isSaving
            ? <span className="text-neutral-500 dark:text-neutral-400">сохранение…</span>
            : isDirty
              ? <span className="text-amber-600 dark:text-amber-400">● есть несохранённые изменения</span>
              : lastSavedAt
                ? <span className="text-neutral-500 dark:text-neutral-400">
                    сохранено в {new Date(lastSavedAt).toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"})}
                  </span>
                : null}
          {sceneVersion != null && (
            <span className="ml-2 text-neutral-400 dark:text-neutral-500">версия {sceneVersion}</span>
          )}
        </span>
      )}
    </div>
  );
}
