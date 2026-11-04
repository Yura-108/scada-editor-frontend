'use client';

import React, {useMemo} from 'react';
import {MousePointerClick, Inbox} from 'lucide-react';
import {clsx} from 'clsx';
import {resolveParamWidget, useDeviceSelection, useDeviceTreeStore, useEditingDevices} from "@/core/devices";
import {EmptyState} from "@/shared/ui/EmptyState";
import {useParamDraft} from "../model/useParamDraft";
import {useReleaseEditingOnLeave} from "../model/useReleaseEditingOnLeave";
import {useParamDraftGuard} from "../model/useParamDraftGuard";
import {DeviceParamsHeader} from "./DeviceParamsHeader";
import {OptionParamsList} from "./OptionParamsList";
import {ParamGrid} from "./ParamGrid";

/** Числовые ключи — по числу (иначе «10» шёл бы раньше «9»), прочие — как строки. */
const byParamKey = (a: {key: string}, b: {key: string}) => {
  const x = Number(a.key), y = Number(b.key);
  return Number.isFinite(x) && Number.isFinite(y) ? x - y : String(a.key).localeCompare(String(b.key));
};

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
  const {editedParams, errors, hasChanges, isSaving, saveStatus, handleChange, handleSave, discardChanges} = useParamDraft(selectedDevice);
  const currentDevice = nodes.find((node) => node.key === selectedDevice);
  const {toggleEditing, confirmDiscard} = useParamDraftGuard({
    selectedDevice, deviceTitle: currentDevice?.title, isEditingSelected, hasChanges, handleSave, discardChanges,
  });

  // Тот же отбор, что у getParams, но по params из подписки — иначе список не узнал бы о правке.
  // Порядок — по ключу: бэкенд отдаёт параметры в порядке изменения, и после F5 правленый
  // уезжал в конец списка. Ключ при правке не меняется, порядок совпадает с порядком создания.
  const rawParams = useMemo(
    () => (selectedDevice ? params.filter(p => p.parentKey === selectedDevice).sort(byParamKey) : []),
    [selectedDevice, params],
  );

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
    <div className="min-h-full flex flex-col bg-card border border-border rounded-2xl shadow-sm">
      <DeviceParamsHeader
        deviceTitle={currentDevice?.title}
        paramCount={rawParams.length}
        isEditingSelected={isEditingSelected}
        hasChanges={hasChanges}
        errorCount={errors.size}
        isSaving={isSaving}
        saveStatus={saveStatus}
        handleSave={() => void handleSave()}
        onToggleEditing={() => void toggleEditing()}
        onDiscard={() => void confirmDiscard()}
      />

      <div
        className={clsx(
          "relative transition-all",
          !isEditingSelected && "pointer-events-none select-none opacity-50",
        )}
      >
        {/* Форма */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-6">
          <ParamGrid normalParams={normalParams} editedParams={editedParams} errors={errors} handleChange={handleChange} />
        </div>

        <OptionParamsList optionItems={optionItems} />
      </div>
    </div>
  );
};

export default DeviceParams;
