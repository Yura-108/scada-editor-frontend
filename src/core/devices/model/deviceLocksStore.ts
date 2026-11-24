'use client';

import {create} from 'zustand/react';
import {devtools} from 'zustand/middleware';
import {toast} from "sonner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {treeSearch} from "../lib/treeSearch";
import {errorMessage, lockDevices, unlockDevices} from "../api/devicesApi";
import {useDeviceTreeStore} from "./deviceTreeStore";

/**
 * Узлы, которые текущий пользователь держит на правке (redis-блокировки бэкенда).
 * Отдельно от дерева: блокировки читают и шапка (выход снимает их), и подписи узлов.
 */
/** Сколько вложенных узлов блокируется без вопроса: канал или небольшое устройство. */
const BIG_LOCK = 20;

interface DeviceLocksState {
  editingDevices: Array<string>;
  startEditing: (keys: string[]) => Promise<void>;
  stopEditing: (keys: string[]) => Promise<void>;
  toggleEditing: (key: string) => Promise<void>;
}

export const useDeviceLocksStore = create<DeviceLocksState>()(
  devtools(
    (set, get) => ({
      editingDevices: [],
      startEditing: async (keys: string[]) => {
        const {editingDevices} = get();
        const filteredKeys = keys.filter((key: string) => !editingDevices.includes(key));
        try {
          const lockedDevices = await lockDevices(filteredKeys);

          set({
            editingDevices: [...editingDevices, ...lockedDevices],
          });

          // Бэкенд может вернуть 200 и пустой список — узел держит другой пользователь.
          // Без сообщения это выглядело как «кнопка не работает».
          if (filteredKeys.length > 0 && lockedDevices.length === 0) {
            toast.error('Узел уже редактируется другим пользователем');
          }
        } catch (err) {
          console.error("Lock failed: ", err);
          toast.error(errorMessage(err, 'Не удалось начать редактирование'));
        }
      },
      stopEditing: async (keys: string[]) => {
        try {
          const unlockedDevices = await unlockDevices(keys);

          set(state => ({
            editingDevices: state.editingDevices.filter(device => !unlockedDevices.includes(device)),
          }));
        } catch (err) {
          console.error("Unlock failed: ", err);
          toast.error(errorMessage(err, 'Не удалось завершить редактирование'));
        }
      },
      toggleEditing: async (key: string) => {
        const editingTree = treeSearch(key, useDeviceTreeStore.getState().nodes) ?? [];
        const {editingDevices} = get();
        if (editingDevices.includes(key)) {
          await get().stopEditing(editingTree);
          return;
        }
        // Правка берёт блокировку на всё поддерево: на устройстве — сотни каналов, которые
        // никто другой не сможет править. Раньше это происходило молча (#16 п. 5).
        const others = editingTree.length - 1;
        if (others > BIG_LOCK) {
          const ok = await confirmModal({
            title: `Начать редактирование «${key.split(".").pop()}»?`,
            description: `Вместе с узлом будут заблокированы все вложенные — ещё ${others}. ` +
              "Пока вы не закончите редактирование, другие пользователи не смогут их править.",
            confirmLabel: "Начать редактирование",
          });
          if (!ok) return;
        }
        await get().startEditing(editingTree);
      },
    }),
  ),
);
