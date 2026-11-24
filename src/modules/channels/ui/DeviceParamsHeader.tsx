'use client';

import React from 'react';
import {Save, AlertCircle, CheckCircle2, Settings, Edit3, Plus, Undo2} from 'lucide-react';
import {clsx} from 'clsx';
import {loadParamTypes, openChooseParamTypeModal} from "@/core/devices";
import {Button} from "@/shared/ui/Button";
import type {ParamSaveStatus} from "../model/useParamDraft";

/**
 * Шапка панели параметров: имя устройства и число параметров, «Начать/Закончить
 * редактирование», «Добавить параметр», «Сохранить изменения», «Отменить изменения» и итог
 * сохранения. Выход из правки с несохранённым спрашивает владелец (`onToggleEditing`).
 */
export function DeviceParamsHeader({deviceTitle, paramCount, isEditingSelected, hasChanges, errorCount, isSaving, saveStatus, handleSave, onToggleEditing, onDiscard}: {
  deviceTitle: string | undefined;
  paramCount: number;
  isEditingSelected: boolean;
  hasChanges: boolean;
  /** Сколько значений с ошибкой: пока они есть, «Сохранить изменения» неактивна. */
  errorCount: number;
  isSaving: boolean;
  saveStatus: ParamSaveStatus;
  handleSave: () => void;
  onToggleEditing: () => void;
  onDiscard: () => void;
}) {
  const handleLoadParamsTypes = async () => {
    await loadParamTypes();
    openChooseParamTypeModal();
  }

  return <>
    {/* Заголовок */}

    <div className="px-4 py-3">

      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">

        <Settings className="w-5 h-5 text-primary"/>

        Параметры

      </h2>

      <p className="text-xs text-muted-foreground mt-0.5">

        {deviceTitle || 'Device'} • {paramCount} параметров

      </p>

    </div>

    {/* Кнопки — общие `Button` в одну строку каждая, с переносом ряда: раньше это были свои
        кнопки высотой 64 px в две строки текста, и на 800 px «Сохранить изменения» уходила
        за правый край панели (#16 п. 12). */}
    <div className="px-6 py-2 border-y border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">
        <Button variant="primary" onClick={onToggleEditing}>
          <Edit3 size={16} />
          {isEditingSelected ? 'Закончить редактирование' : 'Начать редактирование'}
        </Button>

        <Button variant="primary" disabled={!isEditingSelected} onClick={() => void handleLoadParamsTypes()}>
          <Plus size={16} />
          Добавить параметр
        </Button>

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || errorCount > 0}
          title={errorCount > 0 ? `Исправьте значения с ошибкой: ${errorCount}` : undefined}
          className={clsx(isSaving && 'cursor-wait')}
        >
          <Save size={16} />
          {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
        </Button>

        {hasChanges && (
          <Button onClick={onDiscard} disabled={isSaving} title="Вернуть в полях значения с сервера">
            <Undo2 size={16} />Отменить изменения
          </Button>
        )}

        {saveStatus === 'success' && (
          <span className="flex items-center gap-2 text-sm text-success font-medium">
            <CheckCircle2 size={16} />
            Сохранено!
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-2 text-sm text-destructive font-medium">
            <AlertCircle size={16} />
            Ошибка сохранения
          </span>
        )}
      </div>
    </div>
  </>;
}
