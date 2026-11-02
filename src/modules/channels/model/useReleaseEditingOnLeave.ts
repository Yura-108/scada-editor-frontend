import {useEffect} from "react";
import {useDeviceLocksStore, useUnlockEditingOnUnload} from "@/core/devices";

/**
 * Блокировки правки устройств снимаются при уходе со страницы: перезагрузку и закрытие вкладки
 * ловит `useUnlockEditingOnUnload` (sendBeacon), SPA-навигацию — очистка эффекта здесь.
 */
export function useReleaseEditingOnLeave() {
  useUnlockEditingOnUnload();

  useEffect(() => {
    return () => {
      const { editingDevices, stopEditing } = useDeviceLocksStore.getState();
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
}
