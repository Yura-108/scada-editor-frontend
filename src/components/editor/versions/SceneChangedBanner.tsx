"use client";

import {RefreshCw, Users, X} from "lucide-react";
import {hasUnsavedWork, useEditorStore} from "@/store/useEditorStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useSceneChangeStore, useVisibleSceneChange} from "@/store/useSceneChangeStore";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {dropScene} from "@/lib/editor/sceneCache";

/**
 * Плашка «сцену сохранил другой инженер» по STOMP-уведомлению `SCENE_CHANGED`
 * (`useSceneChangedNotifications`). Узнать о чужом сохранении сразу, а не когда своё
 * сохранение упрётся в слияние или 409.
 *
 * «Перезагрузить» — тот же путь, что открыть сцену заново, с тем же вопросом про
 * несохранённые правки, что и при переходе на другую схему. Кэш сцены сбрасываем: в нём
 * документ старой версии, и загрузка показала бы именно его. В режиме просмотра версии
 * кнопки нет — на холсте не текущая сцена, перезагружать нечего; только сообщение.
 */
export default function SceneChangedBanner() {
  const notice = useVisibleSceneChange();
  const versionPreview = useEditorStore(s => s.versionPreview);
  const dismiss = useSceneChangeStore(s => s.dismiss);

  if (!notice) return null;

  const reload = async () => {
    if (hasUnsavedWork()) {
      const ok = await confirmModal({
        title: "Схема не сохранена",
        description: "Перезагрузить схему с сервера? Несохранённые изменения будут потеряны.",
        confirmLabel: "Перезагрузить",
        danger: true,
      });
      if (!ok) return;
    }
    const {currentProject, loadScene} = useEditorStore.getState();
    if (currentProject) dropScene(currentProject.id, notice.sceneId);
    await loadScene(notice.sceneId);
    await usePaletteStore.getState().loadPaletteItems();
  };

  return (
    <div
      role="status"
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className={`fixed ${versionPreview ? "top-28" : "top-14"} z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none`}
    >
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-sky-500/40
                   bg-sky-50/95 dark:bg-sky-950/80 px-4 py-2 text-sm text-sky-900 dark:text-sky-100
                   shadow-2xl backdrop-blur-xl"
      >
        <Users size={16} className="shrink-0" />
        <span className="truncate">
          Сцену сохранил{notice.userName ? <> <b>{notice.userName}</b></> : " другой пользователь"},
          версия <b>{notice.versionNo}</b>.
        </span>

        {!versionPreview && (
          <button
            type="button"
            onClick={() => void reload()}
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 px-2 py-1
                       hover:bg-sky-500/15 transition-colors"
          >
            <RefreshCw size={14} />
            Перезагрузить
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть уведомление"
          title="Скрыть уведомление"
          className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1
                     hover:bg-sky-500/15 transition-colors"
        >
          <X size={14} />
          Скрыть
        </button>
      </div>
    </div>
  );
}
