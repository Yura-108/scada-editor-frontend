import { useDeviceStore } from "@/store/useDeviceStore";

/**
 * Реактивный признак «узел сейчас редактируется».
 *
 * Раньше здесь был `useDeviceStore.getState()` — нереактивное чтение. Компонент
 * контекстного меню на стор не подписан, поэтому открытое меню продолжало
 * показывать пункты по устаревшему состоянию блокировки (например, «Редактировать»
 * у уже разблокированного узла).
 */
export const useEditingDevices = (): string[] =>
  useDeviceStore((s) => s.editingDevices);

/** Нереактивная проверка — только вне рендера (обработчики, экшены сторов). */
export const isEditingDevice = (deviceKey: string) =>
  useDeviceStore.getState().editingDevices.includes(deviceKey);
