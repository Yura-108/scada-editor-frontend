import React, {useState} from "react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";
import {useSceneFileImport} from "./hooks/useSceneFileImport";
import {useToolbarAccess} from "./hooks/useToolbarAccess";
import {ArrangeButtons} from "./ArrangeButtons";
import {HistoryButtons} from "./HistoryButtons";
import {SaveButton} from "./SaveButton";
import {SceneButtons} from "./SceneButtons";
import {SceneStatus} from "./SceneStatus";
import {ToolbarDivider} from "./TooltipBtn";
import VersionHistoryPanel from "@/components/editor/versions/VersionHistoryPanel";
import SaveConflictDialog from "@/components/editor/versions/SaveConflictDialog";
import VersionPreviewBanner from "@/components/editor/versions/VersionPreviewBanner";
import StaleVersionBanner from "@/components/editor/versions/StaleVersionBanner";
import SceneChangedBanner from "@/components/editor/versions/SceneChangedBanner";
import AutosaveErrorBanner from "@/components/editor/versions/AutosaveErrorBanner";

/**
 * Отступы тулбара от боковых панелей приходят CSS-переменными от WorkSpace
 * (`--ws-left-m` / `--ws-right-m`), а не числовыми пропсами: во время
 * перетаскивания края панели их пишет обработчик указателя, без ре-рендера.
 *
 * Каждая группа кнопок подписана на стор сама и только на своё: подписка на весь стор
 * перерисовывала панель на каждый тик пана/зума (то же замечание, что и в WorkSpace/Canvas).
 */
export function ToolsPanel() {
  const {scene, currentProject} = useEditorStore(useShallow(s => ({
    scene: s.scene, currentProject: s.currentProject,
  })));
  const [historyOpen, setHistoryOpen] = useState(false);

  const {sceneBelongsToProject, canEdit, canWrite, canSave} = useToolbarAccess();
  const {importInputRef, handleImport, handleImportFile} = useSceneFileImport(sceneBelongsToProject);

  return (
    <nav
      style={{
        left: "var(--ws-left-m, 0px)",
        right: "var(--ws-right-m, 0px)",
      }}
      className="fixed top-26 z-toolbar grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      {/* Проект и сцена: отдельная колонка слева, не влияет на центрирование тулбара */}
      <div className="min-w-0 flex justify-start">
        <SceneStatus canWrite={canWrite} />
      </div>

      <div className="flex gap-1.5 p-1.5 bg-white dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto justify-self-center">

        <SceneButtons canEdit={canEdit} canWrite={canWrite} onImport={handleImport} />

        <ToolbarDivider />

        <HistoryButtons canEdit={canEdit} canWrite={canWrite} onToggleHistory={() => setHistoryOpen(v => !v)} />

        <ToolbarDivider />

        <ArrangeButtons canEdit={canEdit} />

        {canWrite && <SaveButton canSave={canSave} />}
      </div>

      <div className="min-w-0 flex justify-end">
        {scene && currentProject && !sceneBelongsToProject && (
          <div className="truncate text-xs font-medium text-red-500 dark:text-red-400 pointer-events-auto">
            Сцена не принадлежит проекту «{currentProject.name}». Выберите сцену из списка.
          </div>
        )}
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Плашка просмотра, панель истории и диалог конфликта живут здесь, потому что
          тулбар — единственная часть редактора, которая монтируется ровно один раз на
          вкладке «Редактор». Сама <nav> не ловит указатель (pointer-events-none),
          поэтому потомки включают его себе сами. */}
      <VersionPreviewBanner />
      <SceneChangedBanner />
      <StaleVersionBanner />
      <AutosaveErrorBanner />
      <div className="pointer-events-auto">
        <VersionHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      </div>
      <SaveConflictDialog />
    </nav>
  );
}
