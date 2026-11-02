'use client';

import React, {useMemo} from 'react';
import {MousePointerClick, Inbox} from 'lucide-react';
import {clsx} from 'clsx';
import {resolveParamWidget, useDeviceSelection, useDeviceTreeStore, useEditingDevices} from "@/core/devices";
import {EmptyState} from "@/shared/ui/EmptyState";
import {useParamDraft} from "../model/useParamDraft";
import {useReleaseEditingOnLeave} from "../model/useReleaseEditingOnLeave";
import {DeviceParamsHeader} from "./DeviceParamsHeader";
import {OptionParamsList} from "./OptionParamsList";
import {ParamGrid} from "./ParamGrid";

/**
 * Панель параметров выбранного узла на странице «Каналы»: шапка с правкой и сохранением,
 * сетка обычных параметров, «Общие параметры». Вне режима правки форма заблокирована.
 */
const DeviceParams = () => {
  const {
    nodes,
    params,
  } = useDeviceTreeStore();
  const selectedDevice = useDeviceSelection(s => s.selectedDevice);

  // Реактивный признак блокировки: раньше читался через getState() прямо в
  // рендере, поэтому подпись кнопки и блокировка формы не обновлялись, пока
  // компонент не перерисовывался по другой причине.
  const editingDevices = useEditingDevices();
  const isEditingSelected = !!selectedDevice && editingDevices.includes(selectedDevice);

  // Снятие redis-локов при уходе со страницы: перезагрузка, закрытие вкладки, SPA-навигация.
  useReleaseEditingOnLeave();
  const {editedParams, hasChanges, isSaving, saveStatus, handleChange, handleSave} = useParamDraft(selectedDevice);

  // Тот же отбор, что у getParams, но по params из подписки — иначе список не узнал бы о правке.
  const rawParams = useMemo(
    () => (selectedDevice ? params.filter(p => p.parentKey === selectedDevice) : []),
    [selectedDevice, params],
  );

  const currentDevice = nodes.find((node) => node.key === selectedDevice);
  const optionItems = rawParams.filter(param => resolveParamWidget(param.type) === 'option');
  const normalParams = rawParams.filter(param => resolveParamWidget(param.type) !== 'option');

  if (!selectedDevice) {
    return (
      // Обычное пустое состояние, а не ошибка: нейтральная иконка вместо «!».
      <EmptyState icon={MousePointerClick} title="Выберите устройство или канал в дереве слева" className="h-full" />
    );
  }

  if (rawParams.length === 0) {
    return (
      <EmptyState icon={Inbox} title="Нет параметров для отображения" className="h-full" />
    );
  }
  return (
    <div className="min-h-full flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
      <DeviceParamsHeader
        selectedDevice={selectedDevice}
        deviceTitle={currentDevice?.title}
        paramCount={rawParams.length}
        isEditingSelected={isEditingSelected}
        hasChanges={hasChanges}
        isSaving={isSaving}
        saveStatus={saveStatus}
        handleSave={handleSave}
      />

      <div
        className={clsx(
          "relative transition-all",
          !isEditingSelected && "pointer-events-none select-none opacity-50",
        )}
      >
        {/* Форма */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-6">
          <ParamGrid normalParams={normalParams} editedParams={editedParams} handleChange={handleChange} />
        </div>

        <OptionParamsList optionItems={optionItems} />
      </div>
    </div>
  );
};

export default DeviceParams;
