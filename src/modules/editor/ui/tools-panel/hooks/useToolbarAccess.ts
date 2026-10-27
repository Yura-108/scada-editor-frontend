import {useShallow} from "zustand/react/shallow";
import {useCurrentProjectGrant} from "@/core/access";
import {useEditorStore} from "../../../model/editorStore";

export interface ToolbarAccess {
  sceneBelongsToProject: boolean;
  canEdit: boolean;
  canWrite: boolean;
  canSave: boolean;
}

/** Что тулбару можно делать со схемой: править локально, записывать, сохранять. */
export function useToolbarAccess(): ToolbarAccess {
  const {scene, currentProject, versionPreview} = useEditorStore(useShallow(s => ({
    scene: s.scene, currentProject: s.currentProject, versionPreview: s.versionPreview,
  })));

  // Иерархия Проект -> Схема -> Элементы: блокируем операции над сценой,
  // если она не принадлежит выбранному проекту (или проект/сцена не выбраны).
  const sceneBelongsToProject = !!currentProject
    && !!scene
    && (scene.project_id == null || scene.project_id === currentProject.id);
  // В режиме просмотра версии на холсте лежит старая версия: любая правка ушла бы
  // в текущую сцену как чужое прошлое. Одна проверка гасит разом импорт, undo/redo,
  // группировку, выравнивание и сохранение — все они уже завязаны на canEdit.
  const canEdit = sceneBelongsToProject && !versionPreview;
  // Право правки проекта — отдельно от canEdit: с одним «просмотром» схему можно
  // «потыкать» локально (undo, группировка, импорт), но не записать на сервер.
  // Скрываем всё, что пишет: сохранение, новую схему, откат и выпуски.
  const canWrite = useCurrentProjectGrant().edit;
  const canSave = canEdit && canWrite;

  return {sceneBelongsToProject, canEdit, canWrite, canSave};
}
