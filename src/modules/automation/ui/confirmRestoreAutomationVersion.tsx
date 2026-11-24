import React from "react";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import type {AutomationSet} from "@/core/automation";
import {diffVersions} from "../lib/automationDraft";
import {AutomationDiffView, loadAutomationVersion} from "./AutomationVersionChanges";

/**
 * «Восстановить версию N?» — что именно поменяется, до подтверждения, а не после: «v3» само по
 * себе ничего не говорит. `saved` — набор, как он сейчас на сервере. `true` — пользователь согласился.
 */
export async function confirmRestoreAutomationVersion(
  projectId: number,
  versionNo: number,
  saved: AutomationSet,
): Promise<boolean> {
  let preview: React.ReactNode;
  try {
    const target = await loadAutomationVersion(projectId, versionNo);
    preview = target
      ? <AutomationDiffView diff={diffVersions(saved, target)} wording="restore" />
      : <p className="text-xs text-muted-foreground">Содержимое версии не удалось разобрать.</p>;
  } catch (err) {
    preview = <p className="text-xs text-destructive">{(err as Error).message}</p>;
  }
  return confirmModal({
    title: `Восстановить версию ${versionNo}?`,
    description: <div className="space-y-3">
      <p>
        Набор задач заменится содержимым v{versionNo} и сразу уйдёт на исполнение. История не теряется:
        восстановление запишется новой версией. Чтобы вернуть одну задачу, раскройте версию и нажмите «Вернуть» у неё.
      </p>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Что изменится по сравнению с текущей v{saved.version}</p>
        <div className="max-h-[40vh] overflow-y-auto">{preview}</div>
      </div>
    </div>,
    confirmLabel: "Восстановить",
    danger: true,
    wide: true,
  });
}
