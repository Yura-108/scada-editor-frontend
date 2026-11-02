"use client";

import React from "react";
import {RefreshCw, Save, Send} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import type {AutomationDocument} from "../model/useAutomationDocument";

/**
 * Кнопки справа в шапке «Автоматизации»: версия сохранённого набора, «Перечитать»,
 * «Отправить заново», «Сохранить всё (N)». Без права правки остаются версия и «Перечитать».
 */
export function AutomationHeaderActions({doc, canWrite, unsavedCount}: {
  doc: AutomationDocument;
  canWrite: boolean;
  unsavedCount: number;
}) {
  const {saved, draft, saving, dirty} = doc;
  return <>
    {saved?.version != null && <span className="text-xs text-muted-foreground" title="Версия сохранённого набора">v{saved.version}</span>}
    <IconButton icon={RefreshCw} label="Перечитать с сервера" variant="secondary" onClick={() => void doc.reload()} disabled={!draft || saving} />
    {canWrite ? <>
      <IconButton icon={Send} label="Отправить сохранённый набор в automation заново" variant="secondary" onClick={() => void doc.republish()} disabled={!draft || dirty} />
      <Button variant="primary" size="sm" onClick={() => void doc.saveAll()} disabled={!draft || !dirty || saving} title="Сохранить все задачи и watchdog одним набором">
        <Save size={14} />{saving ? "Сохранение…" : unsavedCount > 1 ? `Сохранить всё (${unsavedCount})` : "Сохранить всё"}
      </Button>
    </> : null}
  </>;
}
