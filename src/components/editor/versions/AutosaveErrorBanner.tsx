"use client";

import {useState} from "react";
import {AlertTriangle, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "@/store/useEditorStore";

/**
 * Плашка «автосохранение отклонено» — с причиной от бэкенда.
 *
 * Отказ, который повторяется каждый такт (синтаксическая ошибка в скрипте, контракт
 * 25.09.2026), тостом показывается один раз (см. exportScene), а дальше висит здесь:
 * пока его не исправят, правки не сохраняются, и забыть об этом нельзя. Уходит сама
 * после любого успешного сохранения.
 *
 * Стоит под плашкой «сцену изменил кто-то другой», если та тоже видна: обе про
 * автосохранение, и перекрывать друг друга им нельзя.
 *
 * «Скрыть» запоминает скрытый текст здесь, а не стирает причину в сторе: иначе на
 * следующем такте та же ошибка сочлась бы новой и снова пришла тостом. Другая причина —
 * плашка появится опять.
 */
export default function AutosaveErrorBanner() {
  const {autosaveError, staleBaseVersion, versionPreview} = useEditorStore(
    useShallow(s => ({
      autosaveError: s.autosaveError,
      staleBaseVersion: s.staleBaseVersion,
      versionPreview: s.versionPreview,
    })),
  );
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!autosaveError || autosaveError === dismissed || versionPreview) return null;

  return (
    <div
      role="alert"
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className={`fixed ${staleBaseVersion != null ? "top-28" : "top-14"} z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none`}
    >
      <div
        className="pointer-events-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-red-500/40
                   bg-red-50/95 dark:bg-red-950/80 px-4 py-2 text-sm text-red-900 dark:text-red-100
                   shadow-2xl backdrop-blur-xl"
      >
        <AlertTriangle size={16} className="shrink-0" />
        {/* Полный текст — в title: сообщение бэкенда длинное, а плашка в одну строку. */}
        <span className="truncate" title={autosaveError}>
          Автосохранение отклонено: {autosaveError}
        </span>

        <button
          type="button"
          onClick={() => setDismissed(autosaveError)}
          aria-label="Скрыть уведомление"
          title="Скрыть уведомление"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-2 py-1
                     hover:bg-red-500/15 transition-colors"
        >
          <X size={14} />
          Скрыть
        </button>
      </div>
    </div>
  );
}
