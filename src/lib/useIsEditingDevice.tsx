import { useDeviceStore } from "@/store/useDeviceStore";

export const isEditingDevice = (deviceKey: string) =>
  useDeviceStore.getState().editingDevices.includes(deviceKey);

