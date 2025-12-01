'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';
import { Save, AlertCircle, CheckCircle2, Settings } from 'lucide-react';
import { clsx } from 'clsx';

type ParamType = 'input' | 'textarea' | 'checkbox' | 'option';

interface Param {
  key: number | string;
  parentKey: string;
  name: string;
  type: ParamType;
  value: string;
}

const DeviceParams = () => {
  const selectedDevice = useDeviceStore((state) => state.selectedDevice);
  const nodes = useDeviceStore((state) => state.nodes);
  const getParams = useDeviceStore((state) => state.getParams);
  const updateParam = useDeviceStore((state) => state.updateParam);

  const rawParams = selectedDevice ? getParams(selectedDevice) : [];

  const currentDevice = nodes.find((node) => node.key === selectedDevice);

  // Локальное состояние для редактирования
  const [editedParams, setEditedParams] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Инициализируем редактируемые значения
  useEffect(() => {
    if (!selectedDevice) {
      setEditedParams(new Map());
      return;
    }

    const params = getParams(selectedDevice);
    const map = new Map<string, string>();
    params.forEach((p) => {
      map.set(String(p.key), p.value ?? '');
    });
    setEditedParams(map);
    setSaveStatus('idle');
  }, [selectedDevice]);

  const hasChanges = useMemo(() => {
    return rawParams.some((p) => {
      const original = p.value || '';
      const edited = editedParams.get(String(p.key)) || '';
      return original !== edited;
    });
  }, [rawParams, editedParams]);

  const handleChange = (key: string, value: string) => {
    setEditedParams((prev) => new Map(prev).set(key, value));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      // Собираем ТОЛЬКО изменённые параметры
      const changes = rawParams
        .filter((p) => {
          const original = p.value ?? '';
          const edited = editedParams.get(String(p.key)) ?? '';
          return original !== edited;
        })
        .map((p) => ({
          key: String(p.key),
          value: editedParams.get(String(p.key)) ?? '',
        }));

      if (changes.length === 0) {
        setSaveStatus('success');
        return;
      }

      await updateParam(changes);

      setSaveStatus('success');
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedDevice) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="text-lg">Выберите устройство или канал</p>
      </div>
    );
  }

  if (rawParams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="w-12 h-12" />
          </div>
          <p className="text-lg">Нет параметров для отображения</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full  flex flex-col bg-gradient-to-b from-gray-50 to-white rounded-2xl shadow-xl">
      {/* Заголовок */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Settings className="w-6 h-6 text-purple-600" />
          Параметры
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {currentDevice?.title || 'Device'} • {rawParams.length} параметров
        </p>
      </div>

      {/* Форма */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
        <div className="space-y-6 max-w-2xl mx-auto grid grid-cols-3 gap-4">
          {rawParams.map((param) => {
            const keyStr = String(param.key);
            const value = editedParams.get(keyStr) ?? param.value ?? '';
            const hasChanged = (param.value || '') !== value;

            return (
              <div
                key={param.key}
                className={clsx(
                  'text-sm group relative flex flex-col justify-between bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 p-4',
                  hasChanged
                    ? 'border-purple-400 ring-4 ring-purple-100'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                {/* Метка изменения */}
                {hasChanged && (
                  <div className="absolute -top-3 -right-3 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    Изменено
                  </div>
                )}

                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {param.name}
                </label>

                {param.type === 'input' && (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleChange(keyStr, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-800 font-medium"
                    placeholder="Введите значение..."
                  />
                )}

                {param.type === 'textarea' && (
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(keyStr, e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all resize-none font-medium text-gray-800"
                    placeholder="Введите описание..."
                  />
                )}

                {param.type === 'checkbox' && (
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      id={`cb-${param.key}`}
                      checked={value === '1' || value === 'true' || value === 'on'}
                      onChange={(e) => handleChange(keyStr, e.target.checked ? '1' : '0')}
                      className="w-6 h-6 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <label
                      htmlFor={`cb-${param.key}`}
                      className="text-lg font-medium text-gray-700 cursor-pointer"
                    >
                      {value === '1' || value === 'true' || value === 'on'
                        ? 'Включено'
                        : 'Выключено'}
                    </label>
                  </div>
                )}

                {param.type === 'option' && (
                  <div className="text-sm text-gray-600 font-mono bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {value || '— нет значения —'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Футер с кнопкой */}
      <div className="px-6 py-5 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Сохранено!
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 font-medium">
                <AlertCircle className="w-5 h-5" />
                Ошибка сохранения
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={clsx(
              'flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-white transition-all transform',
              hasChanges
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:scale-105 shadow-xl'
                : 'bg-gray-400 cursor-not-allowed',
              isSaving && 'opacity-70 cursor-wait',
            )}
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceParams;
