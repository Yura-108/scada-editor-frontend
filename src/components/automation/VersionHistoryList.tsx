"use client";

import React from "react";
import {History} from "lucide-react";
import {Button} from "@/components/ui/Button";
import type {VersionSummary} from "@/types/editorVersion.types";

interface Props {
  versions: VersionSummary[];
  /** Версия, на которой сейчас основан черновик: её восстанавливать незачем. */
  currentVersion: number | null;
  /** Несохранённые правки блокируют восстановление — иначе они молча пропадут. */
  dirty: boolean;
  onRestore: (versionNo: number) => void;
}

/** История версий документа проекта (набор automation, таблицы данных): список и «Восстановить». */
export function VersionHistoryList({versions, currentVersion, dirty, onRestore}: Props) {
  return (
    <div className="p-4 space-y-2 max-w-2xl">
      {versions.length === 0 && <p className="text-sm text-neutral-500">Сохранений ещё не было.</p>}
      {versions.map(v => (
        <div key={v.version_no} className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm">
          <History size={14} className="text-neutral-400" />
          <span className="font-medium">v{v.version_no}</span>
          <span className="text-neutral-500">{v.kind}{v.restored_from ? ` из v${v.restored_from}` : ""}</span>
          <span className="text-neutral-500">{v.user_name}</span>
          <span className="flex-1 text-neutral-500">{new Date(v.created_at).toLocaleString("ru")}</span>
          {v.version_no !== currentVersion && (
            <Button onClick={() => onRestore(v.version_no)} disabled={dirty} title={dirty ? "Сначала сохраните или перечитайте набор" : undefined}>
              Восстановить
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
