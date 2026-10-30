"use client";

import {RefreshCw, Users, X} from "lucide-react";
import {hasUnsavedWork} from "../../model/editorStoreInternals";
import {useEditorStore} from "../../model/editorStore";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useSceneChangeStore, useVisibleSceneChange} from "@/store/useSceneChangeStore";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {dropScene} from "@/core/project";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";

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
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className={`fixed ${versionPreview ? "top-28" : "top-14"} z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none`}
    >
      <Banner
        layout="floating"
        tone="info"
        icon={Users}
        className="pointer-events-auto min-w-0 items-center"
        actions={<>
          {!versionPreview && (
            <Button size="sm" onClick={() => void reload()}>
              <RefreshCw size={14} />
              Перезагрузить
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss} title="Скрыть уведомление">
            <X size={14} />
            Скрыть
          </Button>
        </>}
      >
        <div className="truncate">
          Сцену сохранил{notice.userName ? <> <b>{notice.userName}</b></> : " другой пользователь"},
          версия <b>{notice.versionNo}</b>.
        </div>
      </Banner>
    </div>
  );
}
