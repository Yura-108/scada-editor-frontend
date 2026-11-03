'use client';

import {create} from 'zustand/react';

const PREFIX = 'device-params-draft:';

/** Ключ `localStorage` черновика параметров узла. */
export const paramDraftKey = (deviceKey: string) => `${PREFIX}${deviceKey}`;

const readDraftKeys = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const keys = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.add(key.slice(PREFIX.length));
    }
    return keys;
  } catch {
    return new Set();
  }
};

/**
 * Узлы, у которых есть несохранённый черновик параметров. Сам черновик пишет панель
 * параметров «Каналов» (в `localStorage`, он переживает перезагрузку), а здесь — только
 * признак для отметки в дереве: дерево живёт в `core/devices` и панель не импортирует.
 * Отметка ставится сразу при правке, не дожидаясь отложенной записи в `localStorage`.
 */
export const useParamDrafts = create<{
  keys: Set<string>;
  mark: (deviceKey: string, hasDraft: boolean) => void;
}>()((set, get) => ({
  keys: readDraftKeys(),
  mark: (deviceKey, hasDraft) => {
    if (get().keys.has(deviceKey) === hasDraft) return;
    const keys = new Set(get().keys);
    if (hasDraft) keys.add(deviceKey); else keys.delete(deviceKey);
    set({keys});
  },
}));
