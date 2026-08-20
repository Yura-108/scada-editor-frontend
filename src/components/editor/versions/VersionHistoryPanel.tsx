"use client";

import React, {useEffect, useState} from "react";
import {Clock, Eye, Loader2, RotateCcw, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "@/store/useEditorStore";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {
  formatVersionTime,
  VERSION_KIND_BADGE,
  VERSION_KIND_LABEL,
} from "@/components/editor/versions/formatVersion";
import type {VersionKind} from "@/types/editorVersion.types";

/** Кроме MANUAL показываем автосохранения и восстановления — по переключателю. */
const ALL_KINDS: VersionKind[] = ["MANUAL", "AUTOSAVE", "RESTORE"];

/**
 * Панель «История версий».
 *
 * Отмена в редакторе осталась клиентской (Ctrl+Z, zundo): она мгновенная и работает
 * по действиям. Эта панель — про другое: сохранённые состояния документа на сервере,
 * с автором и временем. По умолчанию показываем только ручные сохранения — за смену
 * автосейв успевает создать несколько десятков версий, и в списке «как было» они
 * только мешают.
 */
export default function VersionHistoryPanel({open, onClose}: {open: boolean; onClose: () => void}) {
  const {
    scene, versions, isVersionsLoading, versionsExhausted, sceneVersion,
    loadVersions, previewVersion, restoreVersion, previewVersionAt,
  } = useEditorStore(useShallow(s => ({
    scene: s.scene,
    versions: s.versions,
    isVersionsLoading: s.isVersionsLoading,
    versionsExhausted: s.versionsExhausted,
    sceneVersion: s.sceneVersion,
    loadVersions: s.loadVersions,
    previewVersion: s.previewVersion,
    restoreVersion: s.restoreVersion,
    previewVersionAt: s.previewVersionAt,
  })));

  const [showAll, setShowAll] = useState(false);
  const [atTime, setAtTime] = useState("");

  const kinds = showAll ? ALL_KINDS : (["MANUAL"] as VersionKind[]);

  // Перезагружаем при открытии и при смене фильтра. Ключом служит id сцены:
  // открытая панель после переключения схемы обязана показать её историю, а не чужую.
  useEffect(() => {
    if (!open || !scene?.id) return;
    void loadVersions({kinds});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scene?.id, showAll]);

  if (!open) return null;

  const handleMore = () => {
    const last = versions[versions.length - 1];
    if (!last) return;
    // Курсор — время последней показанной строки, а не offset: история только
    // дописывается, и сохранение во время листания не сдвигает выдачу.
    void loadVersions({kinds, to: last.created_at, append: true});
  };

  const handleRestore = async (versionNo: number) => {
    const ok = await confirmModal({
      title: `Восстановить версию ${versionNo}?`,
      description:
        "История не переписывается: будет создана новая версия с пометкой «Восстановление». " +
        "Несохранённые изменения на холсте будут потеряны.",
      confirmLabel: "Восстановить",
    });
    if (ok) void restoreVersion(versionNo);
  };

  const handleAt = () => {
    if (!atTime) return;
    // datetime-local отдаёт время без зоны — приводим к ISO явно.
    void previewVersionAt(new Date(atTime).toISOString());
  };

  return (
    <aside
      aria-label="История версий"
      // fixed, а не absolute: панель монтируется из тулбара (он сам fixed и высотой в
      // одну строку), но должна занимать всю высоту рабочей области под шапкой.
      className="fixed right-0 top-(--app-header-h) bottom-0 z-panel flex w-[360px] flex-col border-l
                 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/95 backdrop-blur-md"
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-3">
        <span className="text-sm font-semibold">История версий</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть историю версий"
          className="rounded-md p-1 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </header>

      <div className="shrink-0 space-y-3 border-b border-neutral-200 dark:border-neutral-800 p-3">
        <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={showAll}
            onChange={e => setShowAll(e.target.checked)}
            className="accent-primary"
          />
          Показывать автосохранения и восстановления
        </label>

        <div className="space-y-1">
          <label htmlFor="version-at-time" className="block text-xs text-neutral-600 dark:text-neutral-400">
            Состояние на момент времени
          </label>
          <div className="flex gap-2">
            <input
              id="version-at-time"
              type="datetime-local"
              value={atTime}
              onChange={e => setAtTime(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-300 dark:border-neutral-700
                         bg-transparent px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={handleAt}
              disabled={!atTime}
              className="flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-700
                         px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
            >
              <Clock size={13} />
              Открыть
            </button>
          </div>
          {/* История — это точки сохранения, а не непрерывная запись: обещать точность
              до минуты нельзя, и лучше сказать об этом прямо, чем удивить потом. */}
          <p className="text-[11px] leading-tight text-neutral-500">
            Вернётся ближайшее сохранение не позже указанного времени.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!versions.length && !isVersionsLoading && (
          <p className="p-4 text-center text-xs text-neutral-500">
            {showAll ? "Версий пока нет" : "Ручных сохранений пока нет"}
          </p>
        )}

        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {versions.map(v => (
            <li
              key={v.version_no}
              className={`px-3 py-2 text-xs ${
                v.version_no === sceneVersion ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Версия {v.version_no}
                  {v.version_no === sceneVersion && (
                    <span className="ml-1 font-normal text-neutral-500">(текущая)</span>
                  )}
                </span>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${VERSION_KIND_BADGE[v.kind] ?? ""}`}>
                  {VERSION_KIND_LABEL[v.kind] ?? v.kind}
                </span>
              </div>

              <div className="mt-0.5 text-neutral-500">
                {formatVersionTime(v.created_at)}
                {v.user_name ? ` · ${v.user_name}` : ""}
                {v.restored_from != null ? ` · из версии ${v.restored_from}` : ""}
              </div>

              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void previewVersion(v.version_no); }}
                  className="flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-700
                             px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Eye size={12} />
                  Посмотреть
                </button>
                <button
                  type="button"
                  onClick={() => { void handleRestore(v.version_no); }}
                  className="flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-700
                             px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <RotateCcw size={12} />
                  Восстановить
                </button>
              </div>
            </li>
          ))}
        </ul>

        {isVersionsLoading && (
          <p className="flex items-center justify-center gap-2 p-3 text-xs text-neutral-500">
            <Loader2 size={14} className="animate-spin" />
            Загрузка…
          </p>
        )}

        {!!versions.length && !versionsExhausted && !isVersionsLoading && (
          <button
            type="button"
            onClick={handleMore}
            className="w-full p-2 text-xs text-primary hover:bg-black/5 dark:hover:bg-white/10"
          >
            Показать ещё
          </button>
        )}
      </div>
    </aside>
  );
}
