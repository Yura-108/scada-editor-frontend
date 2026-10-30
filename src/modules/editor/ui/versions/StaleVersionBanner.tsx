"use client";

import {Users, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";
import {useVisibleSceneChange} from "@/store/useSceneChangeStore";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";

/**
 * Плашка «сцену изменил кто-то другой», поднятая автосохранением.
 *
 * Слияние сервер делает только для ручного сохранения, поэтому автосейв при расхождении
 * версии всегда получает отказ — в сцене, открытой вдвоём, это штатное событие раз в
 * десять минут. Модальный диалог здесь неуместен (человек его не просил, а работу он
 * прерывает), но и промолчать нельзя: иначе инженер узнает о чужой правке только когда
 * нажмёт «Сохранить» и получит диалог сравнения из ниоткуда.
 *
 * Ничего не делает сама: ни не перезагружает сцену, ни не сохраняет. Разбираться будет
 * ручное сохранение — у него есть слияние и диалог.
 */
export default function StaleVersionBanner() {
  const {staleBaseVersion, sceneVersion, versionPreview, dismissStaleBaseVersion} = useEditorStore(
    useShallow(s => ({
      staleBaseVersion: s.staleBaseVersion,
      sceneVersion: s.sceneVersion,
      versionPreview: s.versionPreview,
      dismissStaleBaseVersion: s.dismissStaleBaseVersion,
    })),
  );
  // Плашка «сцену сохранил …» стоит выше — эта опускается под неё.
  const sceneChanged = useVisibleSceneChange();

  // В режиме просмотра версии уже висит своя плашка, и вторая рядом только путала бы:
  // там на холсте вообще не текущая сцена.
  if (staleBaseVersion == null || versionPreview) return null;

  return (
    <div
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className={`fixed ${sceneChanged ? "top-[calc(7rem+var(--page-header-h))]" : "top-[calc(3.5rem+var(--page-header-h))]"} z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none`}
    >
      <Banner
        layout="floating"
        tone="info"
        icon={Users}
        className="pointer-events-auto min-w-0 items-center"
        actions={
          <Button size="sm" variant="ghost" onClick={dismissStaleBaseVersion} title="Скрыть уведомление">
            <X size={14} />
            Скрыть
          </Button>
        }
      >
        <div className="truncate">
          Сцену сохранил другой пользователь: у вас версия <b>{sceneVersion ?? "—"}</b> из{" "}
          <b>{staleBaseVersion}</b>. Автосохранение отложено — нажмите «Сохранить», чтобы
          свести правки.
        </div>
      </Banner>
    </div>
  );
}
