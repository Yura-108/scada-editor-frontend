'use client';

import React from 'react';
import {Save, AlertCircle, CheckCircle2, Settings, Edit3, Plus} from 'lucide-react';
import {clsx} from 'clsx';
import {openChooseParamTypeModal, useDeviceDictionaries, useDeviceLocksStore} from "@/core/devices";
import type {ParamSaveStatus} from "../model/useParamDraft";

/**
 * Шапка панели параметров: имя устройства и число параметров, «Начать/Закончить
 * редактирование», «Добавить параметр», «Сохранить изменения» и итог сохранения.
 */
export function DeviceParamsHeader({selectedDevice, deviceTitle, paramCount, isEditingSelected, hasChanges, isSaving, saveStatus, handleSave}: {
  selectedDevice: string;
  deviceTitle: string | undefined;
  paramCount: number;
  isEditingSelected: boolean;
  hasChanges: boolean;
  isSaving: boolean;
  saveStatus: ParamSaveStatus;
  handleSave: () => void;
}) {
  const { toggleEditing } = useDeviceLocksStore();
  const { getParamsTypes } = useDeviceDictionaries();

  const handleLoadParamsTypes = async () => {
    await getParamsTypes();
    openChooseParamTypeModal();
  }

  return <>
    {/* Заголовок */}
    <div className="px-4 py-3">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/>
        Параметры
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {deviceTitle || 'Device'} • {paramCount} параметров
      </p>
    </div>
    {/* Футер с кнопкой */}
    <div className="px-6 border-b-2 py-2 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <button
          className={clsx(
            'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-white transition-all transform bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105 shadow-xl',
          )}
          onClick={() => toggleEditing(selectedDevice)}
        >
          <Edit3 className="w-5 h-5"/>
          {isEditingSelected ? 'Закончить редактирование' : 'Начать редактирование'}
        </button>

        <button
          disabled={!isEditingSelected}
          className={clsx(
            'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-white transition-all transform shadow-xl',

            // активная кнопка
            'bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105',

            // disabled стили
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:from-purple-600 disabled:hover:to-indigo-600'
          )}
          onClick={handleLoadParamsTypes}
        >
          <Plus size={20} />
          {isSaving ? 'Сохранение...' : 'Добавить параметр'}
        </button>


        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={clsx(
            'flex items-center gap-3 px-4 py-2 rounded-xl font-bold text-white transition-all transform',

            // базовый стиль (как у первой кнопки)
            'bg-linear-to-r from-purple-600 to-indigo-600 shadow-xl',

            // hover только когда не disabled
            'hover:from-purple-700 hover:to-indigo-700 hover:scale-105',

            // disabled состояние
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none',

            // состояние сохранения
            isSaving && 'cursor-wait'
          )}
        >
          <Save className="w-5 h-5"/>
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>


        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
              <CheckCircle2 className="w-5 h-5"/>
              Сохранено!
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
              <AlertCircle className="w-5 h-5"/>
              Ошибка сохранения
            </div>
          )}
        </div>
      </div>
    </div>
  </>;
}
