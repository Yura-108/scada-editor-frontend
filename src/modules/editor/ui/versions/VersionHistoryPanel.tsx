"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {toServerTime} from "@/shared/lib/serverTime";
import {Clock, Eye, RotateCcw, X} from "lucide-react";
import {Spinner} from "@/shared/ui/Spinner";
import {Badge} from "@/shared/ui/Badge";
import {IconButton} from "@/shared/ui/IconButton";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";
import {useCurrentProjectGrant} from "@/core/access";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {
  formatVersionTime,
  VERSION_KIND_LABEL,
  VERSION_KIND_TONE,
} from "./formatVersion";
import type {VersionKind} from "@/core/project";
import {Button} from "@/shared/ui/Button";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Input} from "@/shared/ui/field/Input";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";

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
  // Восстановление пишет новую версию — только с правом правки проекта.
  const canWrite = useCurrentProjectGrant().edit;
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
    // Поле `datetime-local` — местное время без пояса, а бэкенд связывает параметр в
    // LocalDateTime и сравнивает с `created_at`, который у него в UTC (тоже без пояса).
    // Поэтому переводим в UTC и шлём без пояса; прежнее «как есть» открывало версию на
    // величину смещения пояса раньше нужной. Подробно — shared/lib/serverTime.
    void previewVersionAt(toServerTime(new Date(atTime)));
  };

  // Портал в `body`: панель монтируется из тулбара, а он внутри холста — отдельного слоя
  // (`z-canvas`). Изнутри него никакой z-index не поднимет панель над боковыми: история
  // открывалась ПОД панелью свойств, и от неё была видна полоска в 40px (#18 п. 1).
  return createPortal(
    <aside
      aria-label="История версий"
      // На всю высоту рабочей области под шапкой; слой `z-drawer` — над боковыми панелями и
      // их ручками, под шапкой приложения и окнами.
      className="fixed right-0 top-[calc(var(--app-header-h)+var(--page-header-h))] bottom-0 z-drawer flex w-[360px] flex-col border-l
                 bg-card/95 backdrop-blur-md shadow-2xl"
    >
      <header className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-semibold">История версий</span>
        <IconButton icon={X} label="Закрыть историю версий" onClick={onClose} />
      </header>

      <div className="shrink-0 space-y-3 border-b border-border p-3">
        <Checkbox
          className="text-xs text-muted-foreground"
          checked={showAll}
          onChange={e => setShowAll(e.target.checked)}
          label="Показывать автосохранения и восстановления"
        />

        <div className="space-y-1">
          <label htmlFor="version-at-time" className={fieldLabelSmClass}>
            Состояние на момент времени
          </label>
          <div className="flex gap-2">
            <Input
              id="version-at-time"
              size="sm"
              type="datetime-local"
              value={atTime}
              onChange={e => setAtTime(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button size="sm" onClick={handleAt} disabled={!atTime}>
              <Clock size={13} />
              Открыть
            </Button>
          </div>
          {/* История — это точки сохранения, а не непрерывная запись: обещать точность
              до минуты нельзя, и лучше сказать об этом прямо, чем удивить потом. */}
          <p className="text-[11px] leading-tight text-muted-foreground">
            Вернётся ближайшее сохранение не позже указанного времени.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!versions.length && !isVersionsLoading && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            {showAll ? "Версий пока нет" : "Ручных сохранений пока нет"}
          </p>
        )}

        <ul className="divide-y divide-border">
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
                    <span className="ml-1 font-normal text-muted-foreground">(текущая)</span>
                  )}
                </span>
                <Badge tone={VERSION_KIND_TONE[v.kind] ?? "neutral"} className="shrink-0">
                  {VERSION_KIND_LABEL[v.kind] ?? v.kind}
                </Badge>
              </div>

              <div className="mt-0.5 text-muted-foreground">
                {formatVersionTime(v.created_at)}
                {v.user_name ? ` · ${v.user_name}` : ""}
                {v.restored_from != null ? ` · из версии ${v.restored_from}` : ""}
              </div>

              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => { void previewVersion(v.version_no); }}
                  className="flex items-center gap-1 rounded-md border border-input
                             px-2 py-0.5 hover:bg-accent"
                >
                  <Eye size={12} />
                  Посмотреть
                </button>
                {canWrite && <button
                  type="button"
                  onClick={() => { void handleRestore(v.version_no); }}
                  className="flex items-center gap-1 rounded-md border border-input
                             px-2 py-0.5 hover:bg-accent"
                >
                  <RotateCcw size={12} />
                  Восстановить
                </button>}
              </div>
            </li>
          ))}
        </ul>

        {isVersionsLoading && (
          <Spinner label="Загрузка…" className="justify-center p-3 text-xs" />
        )}

        {!!versions.length && !versionsExhausted && !isVersionsLoading && (
          <button
            type="button"
            onClick={handleMore}
            className="w-full p-2 text-xs text-primary hover:bg-accent"
          >
            Показать ещё
          </button>
        )}
      </div>
    </aside>,
    document.body,
  );
}
