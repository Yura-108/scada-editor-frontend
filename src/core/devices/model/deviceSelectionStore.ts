'use client';

import {create} from 'zustand/react';

/**
 * Выбранный узел базы каналов — клиентское состояние, отдельно от данных дерева
 * (`deviceTreeStore`). Его задаёт клик в дереве «Каналов» и «Автоматизации»; читают
 * панель параметров, IO-таблица и пункты меню, которые действуют на выбранный узел.
 */
interface DeviceSelectionState {
  selectedDevice: string | null;
  selectDevice: (key: string | null) => void;
}

export const useDeviceSelection = create<DeviceSelectionState>()((set) => ({
  selectedDevice: null,
  selectDevice: (key) => set({selectedDevice: key}),
}));
