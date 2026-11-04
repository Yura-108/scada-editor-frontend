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

    {/* Футер с кнопкой */}

    <div className="px-6 border-b-2 py-2 border-t border-border bg-card">

      <div className="flex items-center gap-2">

        <button

          className={clsx(

            'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-primary-foreground transition-all transform bg-primary hover:bg-primary/90 hover:scale-105 shadow-xl',

          )}

          onClick={onToggleEditing}

        >

          <Edit3 className="w-5 h-5"/>

          {isEditingSelected ? 'Закончить редактирование' : 'Начать редактирование'}

        </button>



        <button

          disabled={!isEditingSelected}

          className={clsx(

            'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-primary-foreground transition-all transform shadow-xl',



            // активная кнопка

            'bg-primary hover:bg-primary/90 hover:scale-105',



            // disabled стили

            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-primary'

          )}

          onClick={handleLoadParamsTypes}

        >

          <Plus size={20} />

          {isSaving ? 'Сохранение...' : 'Добавить параметр'}

        </button>





        <button

          onClick={handleSave}

          disabled={!hasChanges || isSaving || errorCount > 0}

          title={errorCount > 0 ? `Исправьте значения с ошибкой: ${errorCount}` : undefined}

          className={clsx(

            'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-primary-foreground transition-all transform',



            // базовый стиль (как у первой кнопки)

            'bg-primary shadow-xl',



            // hover только когда не disabled

            'hover:bg-primary/90 hover:scale-105',



            // disabled состояние

            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none',



            // состояние сохранения

            isSaving && 'cursor-wait'

          )}

        >

          <Save className="w-5 h-5"/>

          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}

        </button>

        {hasChanges && (
          <Button onClick={onDiscard} disabled={isSaving} title="Вернуть в полях значения с сервера">
            <Undo2 size={16} />Отменить изменения
          </Button>
        )}





        <div className="flex items-center gap-3">

          {saveStatus === 'success' && (

            <div className="flex items-center gap-2 text-success font-medium">

              <CheckCircle2 className="w-5 h-5"/>

              Сохранено!

            </div>

          )}

          {saveStatus === 'error' && (

            <div className="flex items-center gap-2 text-destructive font-medium">

              <AlertCircle className="w-5 h-5"/>

              Ошибка сохранения

            </div>

          )}

        </div>

      </div>

    </div>
  </>;
}
