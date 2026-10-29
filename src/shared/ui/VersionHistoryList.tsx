"use client";

import React, {useState} from "react";
import {ChevronDown, ChevronRight, History} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import type {VersionSummary} from "@/types/editorVersion.types";

interface Props {
  versions: VersionSummary[];
  /** Версия, на которой сейчас основан черновик: её восстанавливать незачем. */
  currentVersion: number | null;
  /** Несохранённые правки блокируют восстановление — иначе они молча пропадут. */
  dirty: boolean;
  /** Нет — восстанавливать нельзя (нет права правки): кнопка не показывается. */
  onRestore?: (versionNo: number) => void;
  /**
   * Что изменилось в версии — строка раскрывается по щелчку. `previous` — версия перед ней
   * в списке (её нет у самой старой из загруженных).
   */
  renderDetails?: (version: VersionSummary, previous: VersionSummary | undefined) => React.ReactNode;
}

/** `kind` с сервера — служебное слово; пользователю показываем, что за ним стоит. */
const kindView = (v: VersionSummary): {label: string; hint: string} => {
  switch (v.kind) {
    case "MANUAL":
      return {label: "Сохранение", hint: "Пользователь нажал «Сохранить» (или удалил задачу)"};
    case "AUTOSAVE":
      return {label: "Автосохранение", hint: "Сохранено автоматически по таймеру"};
    case "RESTORE":
      return {
        label: v.restored_from ? `Восстановление v${v.restored_from}` : "Восстановление",
        hint: "Содержимое старой версии записано новой версией",
      };
    default:
      return {label: v.kind, hint: ""};
  }
};

const KIND_CLASS: Record<string, string> = {
  MANUAL: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  AUTOSAVE: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
  RESTORE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

/** История версий документа проекта (набор automation, таблицы данных): список и «Восстановить». */
export function VersionHistoryList({versions, currentVersion, dirty, onRestore, renderDetails}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="p-4 space-y-2 max-w-3xl">
      {versions.length === 0 && <p className="text-sm text-neutral-500">Сохранений ещё не было.</p>}
      {versions.map((v, i) => {
        const open = renderDetails != null && expanded === v.version_no;
        const kind = kindView(v);
        const toggle = () => setExpanded(open ? null : v.version_no);
        return (
          <div key={v.version_no} className="rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              {renderDetails ? (
                <button
                  type="button"
                  onClick={toggle}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  title={open ? "Скрыть подробности" : "Показать, что изменилось"}
                  aria-expanded={open}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <History size={14} className="text-neutral-400" />
              )}
              <span className="font-medium">v{v.version_no}</span>
              <span className={cn("px-1.5 rounded text-xs", KIND_CLASS[v.kind])} title={kind.hint}>{kind.label}</span>
              <span className="text-neutral-500">{v.user_name}</span>
              <span className="text-neutral-500">{new Date(v.created_at).toLocaleString("ru")}</span>
              <span className="flex-1" />
              {renderDetails && (
                <button type="button" onClick={toggle} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  {open ? "Скрыть" : "Подробнее"}
                </button>
              )}
              {v.version_no === currentVersion ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" title="Сейчас действует эта версия">
                  текущая
                </span>
              ) : onRestore && (
                <Button
                  size="sm"
                  onClick={() => onRestore(v.version_no)}
                  disabled={dirty}
                  title={dirty ? "Сначала сохраните или перечитайте набор" : "Посмотреть, что изменится, и вернуть всё к этой версии"}
                >
                  Восстановить…
                </Button>
              )}
            </div>
            {v.comment && (
              <p className="px-3 pb-2 -mt-1 text-xs italic text-neutral-600 dark:text-neutral-400">«{v.comment}»</p>
            )}
            {open && (
              <div className="border-t border-neutral-200 dark:border-neutral-800 px-3 py-2">
                {renderDetails(v, versions[i + 1])}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
