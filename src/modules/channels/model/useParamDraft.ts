import {useEffect, useMemo, useState} from "react";
import debounce from "lodash/debounce";
import {toast} from "sonner";
import {paramDraftKey, paramValueError, updateParam, useDeviceTreeStore, useParamDrafts} from "@/core/devices";

export type ParamSaveStatus = "idle" | "success" | "error";

/**
 * Черновик правок параметров выбранного устройства. Живёт в `localStorage` по ключу устройства
 * (переживает перезагрузку), пишется туда с задержкой. Значение, равное серверному, из черновика
 * убирается. «Сохранить» отправляет только черновик текущего устройства, «Отменить изменения»
 * выбрасывает его. Признак «у узла есть черновик» для дерева — в `useParamDrafts`.
 */
export function useParamDraft(selectedDevice: string | null) {
  const getParams = useDeviceTreeStore(s => s.getParams);
  const markDraft = useParamDrafts(s => s.mark);
  const [editedParams, setEditedParams] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ParamSaveStatus>("idle");

  const draftKey = selectedDevice ? paramDraftKey(selectedDevice) : null;

  // Одна отложенная запись на всё время жизни хука (отменяется при размонтировании).
  const debouncedSaveDraft = useMemo(
    () => debounce((key: string, data: { key: number; value: string; }[]) => {
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
  }, [selectedDevice, draftKey]);

  useEffect(() => {
    if (!draftKey || !selectedDevice) return;

    const arr = [...editedParams].map(([key, value]) => ({
      key: Number(key),
      value
    }));


    if (arr.length === 0) {
      // Отложенная запись прежнего состояния иначе вернула бы черновик после очистки.
      debouncedSaveDraft.cancel();
      localStorage.removeItem(draftKey);
    } else {
      debouncedSaveDraft(draftKey, arr);
    }
    markDraft(selectedDevice, arr.length > 0);
  }, [editedParams, draftKey, selectedDevice, debouncedSaveDraft, markDraft]);

  useEffect(() => {
    return () => {
      debouncedSaveDraft.cancel();
    };
  }, [debouncedSaveDraft]);

  const hasChanges = useMemo(() => {
    return editedParams.size > 0;
  }, [editedParams]);

  // Ошибки значений черновика: ключ параметра → текст. Пока они есть, сохранять нельзя — раньше
  // «abc» в «Период» уходило на сервер, тот отвечал 200, а в базе оставался мусор.
  const errors = useMemo(() => {
    const result = new Map<string, string>();
    if (!selectedDevice) return result;
    const server = getParams(selectedDevice);
    for (const [key, value] of editedParams) {
      const param = server.find(p => String(p.key) === key);
      const error = param ? paramValueError(param.type, param.value, value) : null;
      if (error) result.set(key, error);
    }
    return result;
  }, [editedParams, selectedDevice, getParams]);

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

  /** Сохранить черновик; `false` — не получилось (уходить с несохранённым нельзя). */
  const handleSave = async (): Promise<boolean> => {
    // Кнопка при ошибках неактивна, но сюда приходит и «Сохранить и перейти» из охраны ухода.
    if (errors.size > 0) {
      toast.error("Исправьте значения параметров: есть ошибки");
      return false;
    }
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
        return true;
      }

      await updateParam(arrayChanges);

      // Очистка после успеха — тоже только текущего устройства.
      if (draftKey) localStorage.removeItem(draftKey);
      setEditedParams(new Map());
      setSaveStatus('success');
      return true;
    } catch (err) {
      console.error('Ошибка сохранения параметров:', err);
      setSaveStatus('error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  /** «Отменить изменения»: в полях снова значения с сервера, черновик удалён. */
  const discardChanges = () => {
    setEditedParams(new Map());
    setSaveStatus('idle');
  };

  return {editedParams, errors, hasChanges, isSaving, saveStatus, handleChange, handleSave, discardChanges};
}
