"use client";

import {useEffect} from "react";
import {History, RotateCcw, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";
import {useCurrentProjectGrant} from "@/core/access";
import {shouldIgnoreEditorHotkey} from "../canvas/hooks/useEditorHotkeys";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {
  formatVersionTime,
  VERSION_KIND_LABEL,
} from "./formatVersion";

/**
 * Плашка режима просмотра версии.
 *
 * Холст в этом режиме выглядит ровно как обычный редактор — только не реагирует на
 * правки. Без явной надписи пользователь решит, что редактор сломался, а не что он
 * смотрит прошлое, поэтому плашка обязательна и намеренно заметна.
 */
export default function VersionPreviewBanner() {
  // Восстановление пишет новую версию — только с правом правки проекта.
  const canWrite = useCurrentProjectGrant().edit;
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
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className="fixed top-[calc(3.5rem+var(--page-header-h))] z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none"
    >
      <Banner
        layout="floating"
        tone="warning"
        icon={History}
        className="pointer-events-auto min-w-0 items-center"
        actions={<>
          {/* Без известного номера восстанавливать нечего: `at` возвращает содержимое,
              но не говорит, какая это версия. Показывать кнопку, которая не знает, что
              восстановит, хуже, чем не показывать её вовсе. */}
          {versionNo != null && canWrite && (
            <Button size="sm" onClick={() => { void restoreVersion(versionNo); }}>
              <RotateCcw size={14} />
              Восстановить
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={exitVersionPreview} title="Выйти из просмотра версии">
            <X size={14} />
            Выйти
          </Button>
        </>}
      >
        <div className="truncate">
          {versionNo != null
            ? <>Просмотр версии <b>{versionNo}</b></>
            : <>Просмотр состояния на <b>{when || "выбранный момент"}</b></>}
          {versionNo != null && when ? ` от ${when}` : ""}
          {userName ? `, автор ${userName}` : ""}
          {versionNo != null ? ` · ${VERSION_KIND_LABEL[kind] ?? kind}` : ""}
          {" · только для чтения"}
        </div>
      </Banner>
    </div>
  );
}
