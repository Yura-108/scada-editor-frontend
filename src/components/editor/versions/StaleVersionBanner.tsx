"use client";

import {Users, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "@/store/useEditorStore";

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

  // В режиме просмотра версии уже висит своя плашка, и вторая рядом только путала бы:
  // там на холсте вообще не текущая сцена.
  if (staleBaseVersion == null || versionPreview) return null;

  return (
    <div
      role="status"
      style={{left: "var(--ws-left-m, 0px)", right: "var(--ws-right-m, 0px)"}}
      className="fixed top-14 z-toolbar flex items-center justify-center gap-3 px-4 pointer-events-none"
    >
      <div
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-sky-500/40
                   bg-sky-50/95 dark:bg-sky-950/80 px-4 py-2 text-sm text-sky-900 dark:text-sky-100
                   shadow-2xl backdrop-blur-xl"
      >
        <Users size={16} className="shrink-0" />
        <span className="truncate">
          Сцену сохранил другой пользователь: у вас версия <b>{sceneVersion ?? "—"}</b> из{" "}
          <b>{staleBaseVersion}</b>. Автосохранение отложено — нажмите «Сохранить», чтобы
          свести правки.
        </span>

        <button
          type="button"
          onClick={dismissStaleBaseVersion}
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
