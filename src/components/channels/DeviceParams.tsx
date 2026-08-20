'use client';

import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {useDeviceStore} from '@/store/useDeviceStore';
import {Save, AlertCircle, CheckCircle2, Settings, Edit3, Plus} from 'lucide-react';
import {clsx} from 'clsx';
import ParamWrapper from "@/components/ui/ParamWrapper";
import ContextMenu from "@/components/ui/ContextMenu";
import {
  ContextMenuTrigger,
  ContextMenuType,
  contextMenuTriggerFromKey,
  isContextMenuKey,
} from "@/types/contextMenu.type";
import {paramMenuItems} from "@/constants/contextMenuItems";
import debounce from 'lodash/debounce';
import { useEditingDevices } from "@/lib/useIsEditingDevice";
import {openChooseParamTypeModal} from "@/components/ui/OpenChooseParamTypeModal";
import {useUnlockEditingOnUnload} from "@/lib/useUnlockEditingOnUnload";
import {resolveParamWidget, isParamChecked} from "@/lib/paramWidget";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {toast} from "sonner";

const DeviceParams = () => {
  const {
    nodes,
    selectedDevice,
    getParams,
    updateParam,
    handleContextParamAction,
    params,
    removeParam,
    toggleEditing,
    getParamsTypes,
  } = useDeviceStore();

  // Реактивный признак блокировки: раньше читался через getState() прямо в
  // рендере, поэтому подпись кнопки и блокировка формы не обновлялись, пока
  // компонент не перерисовывался по другой причине.
  const editingDevices = useEditingDevices();
  const isEditingSelected = !!selectedDevice && editingDevices.includes(selectedDevice);

  // Снятие redis-локов при перезагрузке/закрытии вкладки (sendBeacon).
  // SPA-навигацию закрывает cleanup-эффект ниже.
  useUnlockEditingOnUnload();

  const rawParams = useMemo(() => {
    return selectedDevice ? getParams(selectedDevice) : [];
  }, [selectedDevice, params, getParams]);

  const currentDevice = nodes.find((node) => node.key === selectedDevice);
  const optionItems = rawParams.filter(param => resolveParamWidget(param.type) === 'option');
  const normalParams = rawParams.filter(param => resolveParamWidget(param.type) !== 'option');

  const [editedParams, setEditedParams] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [contextMenu, setContextMenu] = useState<ContextMenuType | null>(null);

  const draftKey = selectedDevice ? `device-params-draft:${selectedDevice}` : null;

  const debouncedSaveDraft = useCallback(
    debounce((key: string, data: { key: number; value: string; }[]) => {
      localStorage.setItem(key, JSON.stringify(data));
    }, 400),
    []
  );

  useEffect(() => {
    return () => {
      const { editingDevices, stopEditing } = useDeviceStore.getState();
      if (editingDevices.length === 0) return;

      (async () => {
        try {
          await stopEditing(editingDevices);
        } catch (err) {
          console.error("Cleanup unlock failed:", err);
        }
      })();
    };
  }, []);

  useEffect(() => {
    if (!draftKey || !selectedDevice) {
      setEditedParams(new Map());
      return;
    }
    try {
      const saved = localStorage.getItem(draftKey);

      if (saved) {
        const arr: {key: number; value: string}[] = JSON.parse(saved);

        const map = new Map<string, string>(arr.map(item => [String(item.key), item.value]));
        setEditedParams(map);
      }
    } catch (error) {
      console.warn("Ошибка чтения draft", error);
      setEditedParams(new Map());
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (!draftKey || !selectedDevice) return;

    const arr = [...editedParams].map(([key, value]) => ({
      key: Number(key),
      value
    }));


    if (arr.length === 0) {
      localStorage.removeItem(draftKey);
    } else {
      debouncedSaveDraft(draftKey, arr);
    }
  }, [editedParams, draftKey]);

  useEffect(() => {
    return () => {
      debouncedSaveDraft.cancel();
    };
  }, [debouncedSaveDraft]);

  const hasChanges = useMemo(() => {
    return editedParams.size > 0;
  }, [editedParams]);

  const handleRemoveParam = async (key: string) => {
    const confirmed = await confirmModal({
      title: 'Удалить параметр?',
      description: 'Параметр будет удалён безвозвратно.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await removeParam(key);
      toast.success('Параметр удалён');
    } catch (err) {
      // Раньше ошибка уходила только в консоль: строка оставалась на экране,
      // и пользователь считал, что удаление прошло.
      console.error('Ошибка при удалении параметра:', err);
      toast.error(err instanceof Error ? err.message : 'Не удалось удалить параметр');
    }
  }
  const handleChange = (key: string, value: string) => {
    if (!selectedDevice) return;
    const serverValue = getParams(selectedDevice).find((param) => String(param.key) === key)?.value ?? '';
    setEditedParams((prev) => {
      const next = new Map(prev);

      if (value === serverValue) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    })
    setSaveStatus('idle');
  };
  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Отправляем ТОЛЬКО черновик текущего устройства. Раньше здесь перебирался
      // весь localStorage по префиксу 'device-params-draft:', из-за чего кнопка,
      // активная по изменениям одного устройства (hasChanges), записывала заодно
      // устаревшие черновики других устройств и других сессий.
      const arrayChanges: Array<{key: string; value: string}> = [...editedParams].map(
        ([key, value]) => ({key, value}),
      );

      if (arrayChanges.length === 0) {
        setSaveStatus('idle');
        return;
      }

      await updateParam(arrayChanges);

      // Очистка после успеха — тоже только текущего устройства.
      if (draftKey) localStorage.removeItem(draftKey);
      setEditedParams(new Map());
      setSaveStatus('success');
    } catch (err) {
      console.error('Ошибка сохранения параметров:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }
  const handleContextMenu = (e: ContextMenuTrigger, key: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      key: key,
    });
  }
  const handleLoadParamsTypes = async () => {
    await getParamsTypes();
    openChooseParamTypeModal();
  }

  if (!selectedDevice) {
    return (
      <div className="flex flex-col items-center justify-start mt-10 h-full text-gray-600 dark:text-gray-400">
        <AlertCircle className="w-12 h-12 mb-4"/>
        <p className="text-lg">Выберите устройство или канал</p>
      </div>
    );
  }

  if (rawParams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 dark:text-gray-400">
        <div className="text-center">
          <div className="bg-gray-100 dark:bg-neutral-800 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-12 h-12"/>
          </div>
          <p className="text-lg">Нет параметров для отображения</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-app flex flex-col bg-linear-to-b from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-900 border border-transparent dark:border-neutral-800 rounded-2xl shadow-xl">
      {/* Заголовок */}
      <div className="px-6 py-4 bg-linear-to-r from-purple-100 to-indigo-200 dark:from-purple-950/60 dark:to-indigo-950/60 rounded-2xl">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400"/>
          Параметры
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {currentDevice?.title || 'Device'} • {rawParams.length} параметров
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

      <div
        className={clsx(
          "relative transition-all",
          !isEditingSelected && "pointer-events-none select-none opacity-50",
        )}
      >
        {/* Форма */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-6">
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
            {normalParams.map((param) => {
              const keyStr = String(param.key);
              const value = editedParams.get(keyStr) ?? param.value ?? '';
              const hasChanged = (param.value || '') !== value;
              const widget = resolveParamWidget(param.type);
              const checked = isParamChecked(value);

              return (
                <ParamWrapper
                  key={param.key}
                  param={param}
                  hasChanged={hasChanged}
                  onRemove={handleRemoveParam}
                >
                  {widget === 'input' && (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleChange(keyStr, e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-gray-400 dark:hover:border-neutral-600 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-500/20 outline-none transition-all text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 font-medium"
                      placeholder="Введите значение..."
                    />
                  )}

                  {widget === 'textarea' && (
                    <textarea
                      value={value}
                      onChange={(e) => handleChange(keyStr, e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-gray-400 dark:hover:border-neutral-600 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-500/20 outline-none transition-all resize-none font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                      placeholder="Введите описание..."
                    />
                  )}

                  {widget === 'checkbox' && (
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        id={`cb-${param.key}`}
                        checked={checked}
                        onChange={(e) => handleChange(keyStr, e.target.checked ? 'true' : 'false')}
                        className="w-5 h-5 accent-purple-600 cursor-pointer"
                      />
                      <label
                        htmlFor={`cb-${param.key}`}
                        className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        {checked ? 'Включено' : 'Выключено'}
                      </label>
                    </div>
                  )}
                </ParamWrapper>
              );
            })}


          </div>
          {/* Контекстное меню */}
          {contextMenu && (
            <ContextMenu
              selectElement={true}
              menu={contextMenu}
              items={paramMenuItems}
              onAction={(action) => handleContextParamAction(action, contextMenu?.key)}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>

        {/* Общие параметры */}
        <div className='text-sm group relative flex flex-col justify-between transition-all duration-200 px-6 py-6 col-span-2'>
          <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Общие параметры
          </label>
          <div
            onContextMenu={(e) => handleContextMenu(e, null)}
            className={"w-full h-48 overflow-y-auto pb-8 px-4 py-3 rounded-xl border border-gray-400 dark:border-neutral-700 bg-white dark:bg-neutral-950 transition-all text-gray-600 dark:text-gray-400 "}
          >
            {optionItems.map(p => (
              // Строка достижима с клавиатуры: единственное действие над ней —
              // контекстное меню, а раньше на ней висел только onContextMenu,
              // то есть без мыши параметр было не удалить.
              <div
                key={p.key}
                role="button"
                tabIndex={0}
                title="Правая кнопка мыши или Shift+F10 — меню параметра"
                onContextMenu={(e) => handleContextMenu(e, p.key)}
                onKeyDown={(e) => {
                  if (isContextMenuKey(e) || e.key === "Enter" || e.key === " ") {
                    handleContextMenu(contextMenuTriggerFromKey(e), p.key);
                  }
                }}
                className={clsx(
                  "text-gray-700 dark:text-gray-300 px-2 py-1 cursor-pointer transition-all duration-150 \n" +
                  "    border-l-0 hover:border-l-4 hover:border-blue-500",
                  contextMenu?.visible && contextMenu?.key === p.key ? "bg-blue-300 dark:bg-blue-500/40" : ""
                )}
              >
                {p.value}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DeviceParams;


