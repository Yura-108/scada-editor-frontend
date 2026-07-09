import { useEffect } from "react";
import { useDeviceStore } from "@/store/useDeviceStore";

/**
 * Снимает блокировки (unlock) при ВЫГРУЗКЕ страницы: перезагрузка, закрытие вкладки,
 * жёсткий переход. В этот момент обычный async `fetch` из cleanup-эффекта отменяется
 * вместе со страницей, поэтому редис-локи оставались бы навсегда.
 *
 * Используем `pagehide` + `navigator.sendBeacon` — браузер гарантированно ставит запрос
 * в очередь и доставляет его после выгрузки. Cookie `access_token` уходит автоматически
 * (same-origin), так что `protectedRoute` на /api/unlock проходит.
 *
 * Событие `pagehide` (в отличие от `visibilitychange`) не срабатывает при простом
 * переключении вкладок — значит, лок не снимется, пока пользователь реально не уйдёт.
 * SPA-навигацию внутри приложения по-прежнему закрывает обычный cleanup в компоненте.
 */
export function useUnlockEditingOnUnload() {
  useEffect(() => {
    const flushUnlock = () => {
      const { editingDevices } = useDeviceStore.getState();
      if (!editingDevices.length) return;

      const url = "/api/unlock/";
      const body = JSON.stringify(editingDevices);

      const sent =
        typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
          ? navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))
          : false;

      if (!sent) {
        // Фолбэк: keepalive позволяет запросу пережить выгрузку страницы.
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", flushUnlock);
    return () => window.removeEventListener("pagehide", flushUnlock);
  }, []);
}
