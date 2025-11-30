'use client';

import { create } from 'zustand/react';
import { DeviceNodeType, DeviceParamsType, DeviceTreeResponse } from '@/types/nodeTypes';
import { devtools, persist } from 'zustand/middleware';
interface DeviceStoreState {
  nodes: DeviceNodeType[];
  params: DeviceParamsType[];
  selectedDevice: string | null;

  getParams(deviceKey: string | null): DeviceParamsType[];

  loadTree: (site: string, project: string) => Promise<void>;

  addDevice: (parentKey: string, title: string) => Promise<void>;
  removeDevice: (Key: string) => Promise<void>;

  updateParam: (value: { key: string; value: string }[]) => Promise<void>;
}

export const useDeviceStore = create<DeviceStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        nodes: [],
        params: [],
        selectedDevice: null,

        getParams: (deviceKey: string | null) => {
          if (!deviceKey) return [];
          return get().params.filter((param) => param.parentKey === deviceKey);
        },

        loadTree: async (site: string, project: string) => {
          const res = await fetch(
            `/api/device?site=${encodeURIComponent(site)}&project=${encodeURIComponent(project)}`,
          );
          const json: DeviceTreeResponse = await res.json();

          set({
            nodes: json.nodes,
            params: json.params,
          });
        },

        addDevice: async (parentKey: string, title: string) => {
          const res = await fetch('/api/device/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentKey, title }),
          });

          const newNode: DeviceNodeType = await res.json();

          set((state) => ({
            nodes: [...state.nodes, newNode],
          }));
        },

        removeDevice: async (key: string) => {
          await fetch(`/api/device/${key}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });

          set((state) => ({
            nodes: state.nodes.filter((n) => n.key !== key),
            params: state.params.filter((p) => p.parentKey !== key),
          }));
        },

        updateParam: async (changes: { key: string; value: string }[]) => {
          const res = await fetch('/api/device/param', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: changes }),
          });

          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Ошибка сохранения параметров');
          }

          const updated = await res.json(); // ожидаем { value: [ { key, value }, ... ] }

          const updatedList = updated.value;

          set((state) => ({
            params: state.params.map((param) => {
              const upd = updatedList.find((u: any) => u.key === String(param.key));
              return upd ? { ...param, value: upd.value } : param;
            }),
          }));
        },
      }),
      {
        name: 'device-store', // имя для persist (localStorage)
      },
    ),
  ),
);
