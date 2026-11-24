"use client";

import {useStore} from "zustand";
import {useShallow} from "zustand/react/shallow";
import {History, Redo2, Rocket, RotateCcw, Undo2} from "lucide-react";
import {openReleasesModal} from "../project/ReleasesModal";
import {useEditorStore} from "../../model/editorStore";
import {TooltipBtn} from "./TooltipBtn";

interface HistoryButtonsProps {
  canEdit: boolean;
  canWrite: boolean;
  onToggleHistory: () => void;
}

/** Отмена и повтор, история версий, откат к сохранению и выпуски проекта. */
export function HistoryButtons({canEdit, canWrite, onToggleHistory}: HistoryButtonsProps) {
  const {scene, currentProject, versionPreview, sceneVersion} = useEditorStore(useShallow(s => ({
    scene: s.scene, currentProject: s.currentProject,
    versionPreview: s.versionPreview, sceneVersion: s.sceneVersion,
  })));
  // Глубина стеков undo/redo — чтобы кнопки гасли, когда отменять нечего.
  const canUndo = useStore(useEditorStore.temporal, s => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, s => s.futureStates.length > 0);

  return (
    <>
      {/* Отмена/повтор: раньше существовали только как Ctrl+Z/Ctrl+Y, без
          подсказки в интерфейсе и без признака, что стек пуст. */}
      <TooltipBtn
        icon={<Undo2 size={16} />}
        label="Отменить (Ctrl+Z)"
        onClick={() => useEditorStore.temporal.getState().undo()}
        disabled={!canEdit || !canUndo}
      />
      <TooltipBtn
        icon={<Redo2 size={16} />}
        label="Повторить (Ctrl+Y)"
        onClick={() => useEditorStore.temporal.getState().redo()}
        disabled={!canEdit || !canRedo}
      />

      {/* Отмена выше — клиентская и по действиям (zundo, в памяти). Здесь другое:
          сохранённые на сервере версии схемы, с автором и временем. Обе кнопки
          доступны и в режиме просмотра версии — из него надо уметь выйти в историю. */}
      <TooltipBtn
        icon={<History size={16} />}
        label={sceneVersion != null ? `История версий (текущая ${sceneVersion})` : "История версий"}
        onClick={onToggleHistory}
        disabled={!scene}
      />
      {canWrite && <TooltipBtn
        icon={<RotateCcw size={16} />}
        label="Вернуться к предыдущему сохранению"
        onClick={() => { void useEditorStore.getState().restorePreviousManualVersion(); }}
        disabled={!scene || !!versionPreview}
      />}
      {/* Выпуски — уровень проекта, а не схемы: монитор показывает prod-выпуск, и правки
          доходят до него только через «Выпустить» и «Сделать prod». */}
      {canWrite && <TooltipBtn
        icon={<Rocket size={16} />}
        label="Выпуски проекта"
        onClick={() => currentProject && openReleasesModal(currentProject.id, currentProject.name)}
        disabled={!currentProject}
      />}
    </>
  );
}
