import React from "react";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {diffDataVersions} from "../lib/dataVersionDiff";
import type {ProjectDataTable} from "../types/projectData.types";
import {DataDiffView, loadDataVersion} from "./DataVersionChanges";

/**
 * «Восстановить версию таблиц N?» — с тем, что именно поменяется, до подтверждения: номер
 * версии сам по себе ничего не говорит. `true` — пользователь согласился.
 */
export async function confirmRestoreDataVersion(
  projectId: number,
  versionNo: number,
  currentTables: ProjectDataTable[],
  currentVersion: number | null,
): Promise<boolean> {
  let preview: React.ReactNode;
  try {
    const target = await loadDataVersion(projectId, versionNo);
    preview = target
      ? <DataDiffView diff={diffDataVersions(currentTables, target)} wording="restore" />
      : <p className="text-xs text-muted-foreground">Содержимое версии не удалось разобрать.</p>;
  } catch (err) {
    preview = <p className="text-xs text-destructive">{(err as Error).message}</p>;
  }
  return confirmModal({
    title: `Восстановить версию таблиц ${versionNo}?`,
    description: <div className="space-y-3">
      <p>
        Таблицы заменятся содержимым v{versionNo}; восстановление запишется новой версией.
        Чтобы задачи automation увидели откат, нажмите «Применить данные».
      </p>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Что изменится по сравнению с текущей v{currentVersion}</p>
        <div className="max-h-[40vh] overflow-y-auto">{preview}</div>
      </div>
    </div>,
    confirmLabel: "Восстановить",
    danger: true,
    wide: true,
  });
}
