"use client";

import {useEffect} from "react";
import {History, RotateCcw, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "@/store/useEditorStore";
import {shouldIgnoreEditorHotkey} from "@/components/editor/canvas/hooks/useEditorHotkeys";
import {
  formatVersionTime,
  VERSION_KIND_LABEL,
} from "@/components/editor/versions/formatVersion";

/**
 * Плашка режима просмотра версии.
 *
 * Холст в этом режиме выглядит ровно как обычный редактор — только не реагирует на
 * правки. Без явной надписи пользователь решит, что редактор сломался, а не что он
 * смотрит прошлое, поэтому плашка обязательна и намеренно заметна.
 */
export default function VersionPreviewBanner() {
  const {versionPreview, exitVersionPreview, restoreVersion} = useEditorStore(
    useShallow(s => ({
      versionPreview: s.versionPreview,
      exitVersionPreview: s.exitVersionPreview,
      restoreVersion: s.restoreVersion,
    })),
  );

  // Escape закрывает просмотр. Собственный слушатель, а не useEditorHotkeys: тот
  // отключён целиком, пока холст readOnly (enabled: !readOnly), поэтому без этого
  // из режима просмотра нельзя выйти клавиатурой вообще. Правила игнорирования
  // переиспользуем те же — иначе Escape в открытой модалке закрывал бы и её, и просмотр.
  useEffect(() => {
    if (!versionPreview) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || shouldIgnoreEditorHotkey(e)) return;
      e.preventDefault();
      exitVersionPreview();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [versionPreview, exitVersionPreview]);

  if (!versionPreview) return null;

  const {versionNo, kind, userName, createdAt, atTime} = versionPreview;
  const when = formatVersionTime(createdAt || atTime || "");

  return (
    <div
      role="status"
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className="fixed top-14 z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none"
    >
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-500/40
                   bg-amber-50/95 dark:bg-amber-950/80 px-4 py-2 text-sm text-amber-900 dark:text-amber-100
                   shadow-2xl backdrop-blur-xl"
      >
        <History size={16} className="shrink-0" />
        <span className="truncate">
          {versionNo != null
            ? <>Просмотр версии <b>{versionNo}</b></>
            : <>Просмотр состояния на <b>{when || "выбранный момент"}</b></>}
          {versionNo != null && when ? ` от ${when}` : ""}
          {userName ? `, автор ${userName}` : ""}
          {versionNo != null ? ` · ${VERSION_KIND_LABEL[kind] ?? kind}` : ""}
          {" · только для чтения"}
        </span>

        {/* Без известного номера восстанавливать нечего: `at` возвращает содержимое,
            но не говорит, какая это версия. Показывать кнопку, которая не знает, что
            восстановит, хуже, чем не показывать её вовсе. */}
        {versionNo != null && (
          <button
            type="button"
            onClick={() => { void restoreVersion(versionNo); }}
            className="flex items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-500/15
                       px-2.5 py-1 font-medium hover:bg-amber-500/25 transition-colors"
          >
            <RotateCcw size={14} />
            Восстановить
          </button>
        )}

        <button
          type="button"
          onClick={exitVersionPreview}
          aria-label="Выйти из просмотра версии"
          title="Выйти из просмотра версии"
          className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1
                     hover:bg-amber-500/15 transition-colors"
        >
          <X size={14} />
          Выйти
        </button>
      </div>
    </div>
  );
}
