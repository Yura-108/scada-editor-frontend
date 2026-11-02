import {useCallback, useEffect, useMemo, useState} from "react";
import debounce from "lodash/debounce";
import {updateParam, useDeviceTreeStore} from "@/core/devices";

export type ParamSaveStatus = "idle" | "success" | "error";

/**
 * Черновик правок параметров выбранного устройства. Живёт в `localStorage` по ключу устройства
 * (переживает перезагрузку), пишется туда с задержкой. Значение, равное серверному, из черновика
 * убирается. «Сохранить» отправляет только черновик текущего устройства.
 */
export function useParamDraft(selectedDevice: string | null) {
  const getParams = useDeviceTreeStore(s => s.getParams);
  const [editedParams, setEditedParams] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ParamSaveStatus>("idle");

  const draftKey = selectedDevice ? `device-params-draft:${selectedDevice}` : null;

  const debouncedSaveDraft = useCallback(
    debounce((key: string, data: { key: number; value: string; }[]) => {
      localStorage.setItem(key, JSON.stringify(data));
    }, 400),
    []
  );

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
      } else {
        // Без этого правки прежнего устройства оставались в состоянии: эффект ниже записывал
        // их в черновик нового, а «Сохранить» отправлял их с экрана другого устройства.
        setEditedParams(new Map());
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
  };

  return {editedParams, hasChanges, isSaving, saveStatus, handleChange, handleSave};
}
