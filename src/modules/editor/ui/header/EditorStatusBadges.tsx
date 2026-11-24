"use client";

import React from "react";
import {AlertTriangle, Check, CircleDot, Eye, History} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {Badge} from "@/shared/ui/Badge";
import {Spinner} from "@/shared/ui/Spinner";
import {useEditorStore} from "../../model/editorStore";
import {useToolbarAccess} from "../tools-panel/hooks/useToolbarAccess";

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"});

/**
 * Значки справа в шапке редактора — как статусы монитора: схема не из проекта, только
 * просмотр, сохранение и версия. На узком окне от значка остаётся иконка, текст — в подсказке.
 *
 * Статус сохранения нужен потому, что автосохранение тихое и раз в 10 минут: без него не
 * было видно, в безопасности ли работа. При просмотре версии его нет — там говорит плашка,
 * а «сохранено в …» рядом со старой версией только запутает.
 */
export function EditorStatusBadges() {
  const {currentProject, scene, versionPreview, isSaving, isDirty, lastSavedAt, sceneVersion} = useEditorStore(
    useShallow(s => ({
      currentProject: s.currentProject, scene: s.scene, versionPreview: s.versionPreview,
      isSaving: s.isSaving, isDirty: s.isDirty, lastSavedAt: s.lastSavedAt, sceneVersion: s.sceneVersion,
    })),
  );
  const {sceneBelongsToProject, canWrite} = useToolbarAccess();
  const showSave = !!scene && !versionPreview && canWrite;

  return (
    <>
      {scene && currentProject && !sceneBelongsToProject && (
        <Badge
          tone="destructive"
          icon={<AlertTriangle size={12} />}
          title={`Схема не принадлежит проекту «${currentProject.name}». Выберите схему из списка.`}
        >
          <span className="hidden xl:inline">Схема не из этого проекта</span>
        </Badge>
      )}
      {currentProject && !canWrite && (
        <Badge
          tone="warning"
          icon={<Eye size={12} />}
          title="У вас право просмотра проекта: правки остаются локальными и не сохраняются"
        >
          <span className="hidden xl:inline">Только просмотр</span>
        </Badge>
      )}
      {showSave && (isSaving ? (
        <Badge icon={<Spinner size={12} />} title="Схема сохраняется">
          <span className="hidden xl:inline">Сохранение…</span>
        </Badge>
      ) : isDirty ? (
        <Badge tone="warning" icon={<CircleDot size={12} />} title="Есть несохранённые изменения">
          <span className="hidden xl:inline">Не сохранено</span>
        </Badge>
      ) : lastSavedAt ? (
        <Badge tone="success" icon={<Check size={12} />} title={`Сохранено в ${timeOf(lastSavedAt)}`}>
          <span className="hidden xl:inline">Сохранено в </span>{timeOf(lastSavedAt)}
        </Badge>
      ) : null)}
      {showSave && sceneVersion != null && (
        <Badge icon={<History size={12} />} title={`Версия схемы на сервере: ${sceneVersion}`}>
          <span className="hidden xl:inline">Версия </span>{sceneVersion}
        </Badge>
      )}
    </>
  );
}
