"use client";

import React, {useState} from "react";
import {ChevronDown, ChevronRight, History} from "lucide-react";
import {Badge} from "./Badge";
import {Button} from "./Button";
import {EmptyState} from "./EmptyState";
import {IconButton} from "./IconButton";
import type {Tone} from "./tone";
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

const KIND_TONE: Record<string, Tone> = {
  MANUAL: "primary",
  AUTOSAVE: "neutral",
  RESTORE: "warning",
};

/** История версий документа проекта (набор automation, таблицы данных): список и «Восстановить». */
export function VersionHistoryList({versions, currentVersion, dirty, onRestore, renderDetails}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="p-4 space-y-2 max-w-3xl">
      {versions.length === 0 && <EmptyState size="sm" title="Сохранений ещё не было." />}
      {versions.map((v, i) => {
        const open = renderDetails != null && expanded === v.version_no;
        const kind = kindView(v);
        const toggle = () => setExpanded(open ? null : v.version_no);
        return (
          <div key={v.version_no} className="rounded-xl border text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              {renderDetails ? (
                <IconButton
                  icon={open ? ChevronDown : ChevronRight}
                  label={open ? "Скрыть подробности" : "Показать, что изменилось"}
                  size="xs"
                  aria-expanded={open}
                  onClick={toggle}
                />
              ) : (
                <History size={14} className="text-muted-foreground" />
              )}
              <span className="font-medium">v{v.version_no}</span>
              <Badge tone={KIND_TONE[v.kind] ?? "neutral"} title={kind.hint}>{kind.label}</Badge>
              <span className="text-muted-foreground">{v.user_name}</span>
              <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString("ru")}</span>
              <span className="flex-1" />
              {renderDetails && (
                <button type="button" onClick={toggle} className="text-xs text-primary hover:underline">
                  {open ? "Скрыть" : "Подробнее"}
                </button>
              )}
              {v.version_no === currentVersion ? (
                <Badge tone="success" title="Сейчас действует эта версия">текущая</Badge>
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
              <p className="px-3 pb-2 -mt-1 text-xs italic text-muted-foreground">«{v.comment}»</p>
            )}
            {open && (
              <div className="border-t px-3 py-2">
                {renderDetails(v, versions[i + 1])}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
