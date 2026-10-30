import React, {useState} from "react";
import {useSceneFileImport} from "./hooks/useSceneFileImport";
import {useToolbarAccess} from "./hooks/useToolbarAccess";
import {ArrangeButtons} from "./ArrangeButtons";
import {HistoryButtons} from "./HistoryButtons";
import {SaveButton} from "./SaveButton";
import {SceneButtons} from "./SceneButtons";
import {ToolbarDivider} from "./TooltipBtn";
import VersionHistoryPanel from "../versions/VersionHistoryPanel";
import SaveConflictDialog from "../versions/SaveConflictDialog";
import VersionPreviewBanner from "../versions/VersionPreviewBanner";
import StaleVersionBanner from "../versions/StaleVersionBanner";
import SceneChangedBanner from "../versions/SceneChangedBanner";
import AutosaveErrorBanner from "../versions/AutosaveErrorBanner";

/**
 * Отступы тулбара от боковых панелей приходят CSS-переменными от WorkSpace
 * (`--ws-left-m` / `--ws-right-m`), а не числовыми пропсами: во время
 * перетаскивания края панели их пишет обработчик указателя, без ре-рендера.
 *
 * Каждая группа кнопок подписана на стор сама и только на своё: подписка на весь стор
 * перерисовывала панель на каждый тик пана/зума (то же замечание, что и в WorkSpace/Canvas).
 *
 * Проект, схема и статус сохранения — в шапке редактора (`EditorHeader`), здесь только
 * действия над схемой. Отступ сверху — шапка приложения, шапка раздела и полоса вкладок.
 */
export function ToolsPanel() {
  const [historyOpen, setHistoryOpen] = useState(false);

  const {sceneBelongsToProject, canEdit, canWrite, canSave} = useToolbarAccess();
  const {importInputRef, handleImport, handleImportFile} = useSceneFileImport(sceneBelongsToProject);

  return (
    <nav
      style={{
        left: "var(--ws-left-m, 0px)",
        right: "var(--ws-right-m, 0px)",
      }}
      className="fixed top-[calc(var(--app-header-h)+var(--page-header-h)+2.5rem)] z-toolbar flex justify-center px-4 py-2
                 transition-all duration-300 ease-in-out pointer-events-none"
    >
      <div className="flex gap-1.5 p-1.5 bg-white dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto">

        <SceneButtons canEdit={canEdit} onImport={handleImport} />

        <ToolbarDivider />

        <HistoryButtons canEdit={canEdit} canWrite={canWrite} onToggleHistory={() => setHistoryOpen(v => !v)} />

        <ToolbarDivider />

        <ArrangeButtons canEdit={canEdit} />

        {canWrite && <SaveButton canSave={canSave} />}
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
