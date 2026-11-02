"use client";

import React from "react";
import {RefreshCw, Save, Trash2, Upload} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";

/**
 * Кнопки справа в шапке «Данных»: номер версии документа вкладки, «Перечитать», «Удалить
 * таблицу», «Применить данные», «Сохранить». Без права правки остаются версия и «Перечитать».
 */
export function DataHeaderActions({
  onVariablesTab, tablesTab, loaded, version, canWrite, canRemoveTable, tablesLoaded, tablesDirty,
  dirty, saving, invalidCells, onReload, onRemoveTable, onApply, onSave,
}: {
  onVariablesTab: boolean;
  tablesTab: boolean;
  loaded: boolean;
  version: number | null | undefined;
  canWrite: boolean;
  canRemoveTable: boolean;
  tablesLoaded: boolean;
  tablesDirty: boolean;
  dirty: boolean;
  saving: boolean;
  invalidCells: number;
  onReload: () => void;
  onRemoveTable: () => void;
  onApply: () => void;
  onSave: () => void;
}) {
  return <>
    {loaded && version != null && (
      <span className="text-xs text-muted-foreground" title={onVariablesTab ? "Версия набора автоматизации" : "Версия таблиц"}>v{version}</span>
    )}
    <IconButton icon={RefreshCw} label="Перечитать с сервера" variant="secondary" disabled={!loaded} onClick={onReload} />
    {canWrite && tablesTab && canRemoveTable && (
      <Button
        size="sm"
        className="text-destructive"
        onClick={onRemoveTable}
        title="Удалить выбранную таблицу (применится при сохранении)"
      >
        <Trash2 size={14} />Удалить таблицу
      </Button>
    )}
    {canWrite ? <>
      <Button
        size="sm"
        onClick={onApply}
        disabled={!tablesLoaded || tablesDirty}
        title={tablesDirty ? "Сначала сохраните таблицы" : "Попросить automation перечитать сохранённые данные"}
      >
        <Upload size={14} />Применить данные
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={onSave}
        disabled={!loaded || !dirty || saving || (!onVariablesTab && invalidCells > 0)}
        title={!onVariablesTab && invalidCells > 0 ? "Исправьте ячейки с неверным значением" : undefined}
      >
        <Save size={14} />{saving ? "Сохранение…" : "Сохранить"}
      </Button>
    </> : null}
  </>;
}
