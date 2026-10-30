"use client";

import {useState} from "react";
import {AlertTriangle, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";
import {useVisibleSceneChange} from "@/store/useSceneChangeStore";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";

/**
 * Плашка «автосохранение отклонено» — с причиной от бэкенда.
 *
 * Отказ, который повторяется каждый такт (синтаксическая ошибка в скрипте, контракт
 * 25.09.2026), тостом показывается один раз (см. exportScene), а дальше висит здесь:
 * пока его не исправят, правки не сохраняются, и забыть об этом нельзя. Уходит сама
 * после любого успешного сохранения.
 *
 * Стоит под плашками «сцену сохранил …» и «сцену изменил кто-то другой», если они тоже
 * видны: перекрывать друг друга им нельзя.
 *
 * «Скрыть» запоминает скрытый текст здесь, а не стирает причину в сторе: иначе на
 * следующем такте та же ошибка сочлась бы новой и снова пришла тостом. Другая причина —
 * плашка появится опять.
 */
/** Места плашек сверху вниз; классы целиком, чтобы Tailwind их нашёл. */
const TOP_SLOTS = ["top-14", "top-28", "top-42"];

export default function AutosaveErrorBanner() {
  const {autosaveError, staleBaseVersion, versionPreview} = useEditorStore(
    useShallow(s => ({
      autosaveError: s.autosaveError,
      staleBaseVersion: s.staleBaseVersion,
      versionPreview: s.versionPreview,
    })),
  );
  const sceneChanged = useVisibleSceneChange();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!autosaveError || autosaveError === dismissed || versionPreview) return null;

  return (
    <div
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className={`fixed ${TOP_SLOTS[(sceneChanged ? 1 : 0) + (staleBaseVersion != null ? 1 : 0)]} z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none`}
    >
      <Banner
        layout="floating"
        tone="destructive"
        icon={AlertTriangle}
        className="pointer-events-auto min-w-0 max-w-3xl items-center"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setDismissed(autosaveError)} title="Скрыть уведомление">
            <X size={14} />
            Скрыть
          </Button>
        }
      >
        {/* Полный текст — в title: сообщение бэкенда длинное, а плашка в одну строку. */}
        <div className="truncate" title={autosaveError}>
          Автосохранение отклонено: {autosaveError}
        </div>
      </Banner>
    </div>
  );
}
