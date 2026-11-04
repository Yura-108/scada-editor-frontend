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
 *
 * Полоса не шире места между боковыми панелями: раньше она центрировалась и на окне уже
 * ~1280px уходила под них — «Сохранить» и «Импорт» было не нажать. Не помещается — группы
 * переносятся во вторую строку целиком; ничего не прячется, «Сохранить» всегда последняя.
 * Плашки над холстом стоят выше, на полосе вкладок, вторая строка их не задевает.
 */
/** Группа кнопок переносится целиком; разделитель — в конце группы, а не в начале строки. */
const group = "flex gap-1.5";

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
      <div className="flex min-w-0 max-w-full flex-wrap justify-center gap-x-1.5 gap-y-1 p-1.5 bg-card dark:bg-card/50 backdrop-blur-xl border border-border rounded-2xl shadow-2xl pointer-events-auto">

        <div className={group}>
          <SceneButtons canEdit={canEdit} onImport={handleImport} />
          <ToolbarDivider />
        </div>

        <div className={group}>
          <HistoryButtons canEdit={canEdit} canWrite={canWrite} onToggleHistory={() => setHistoryOpen(v => !v)} />
          <ToolbarDivider />
        </div>

        <div className={group}>
          <ArrangeButtons canEdit={canEdit} />
          {canWrite && <SaveButton canSave={canSave} />}
        </div>
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
      {/* Сама панель уходит порталом в body — над боковыми панелями (см. VersionHistoryPanel). */}
      <VersionHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <SaveConflictDialog />
    </nav>
  );
}
