'use client';

import { create } from 'zustand/react';
import { DeviceNodeType, DeviceParamsType, DeviceTreeResponse } from '@/types/nodeTypes';
import { devtools, persist } from 'zustand/middleware';
import {ContextMenuType} from "@/types/contextMenu.type";
import {DeviceAction, ParamAction} from "@/constants/contextMenuItems";

interface DeviceStoreState {
  nodes: DeviceNodeType[];
  params: DeviceParamsType[];
  contextMenu: ContextMenuType | null;
  editingDevices: Array<string>;
  startEditing: (keys: string[]) => Promise<void>;
  stopEditing: (keys: string[]) => Promise<void>;
  setContextMenu: (menu: ContextMenuType | null) => void;
  selectedDevice: string | null;
  getParams(deviceKey: string | null): DeviceParamsType[];
  loadTree: (site: string, project: string) => Promise<void>;
  addDevice: (node: {type: string; title: string; isLeaf: boolean; parentKey: string | null}) => Promise<void>;
  removeDevice: (Key: string) => Promise<void>;
  deleteOptionParam: (key: string) => Promise<void>;
  removeParam: (key: string) => Promise<void>;
  appOptionParam: (param: {name: string; value: string; parentKey: string}) => Promise<void>;
  updateParam: (value: { key: string; value: string }[]) => Promise<void>;
  handleContextAction: (action: DeviceAction, nodeKey: string | null) => Promise<void>;
  handleContextParamAction: (action: ParamAction, paramKey: string | null) => Promise<void>;
}

export const useDeviceStore = create<DeviceStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        nodes: [],
        params: [],
        contextMenu: null,
        editingDevices: [] as string[],
        setContextMenu: (menu) => set({ contextMenu: menu }),
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
        startEditing: async (keys: string[]) => {
          const {editingDevices} = get();
          const filteredKeys = keys.filter((key: string) => !editingDevices.includes(key));
          try {
            await fetch(`api/lock/`, {
              method: 'POST',
              body: JSON.stringify(filteredKeys),
            });

            set({
              editingDevices: [...editingDevices, ...filteredKeys],
            });
          } catch (err) {
            console.error("Lock failed: ", err);
          }
        },
        stopEditing: async (keys: string[]) => {
          try {
            await fetch(`api/unlock/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(keys),
            });

            set(state => ({
              editingDevices: state.editingDevices.filter(device => !keys.includes(device)),
            }));
          } catch (err) {
            console.error("Unlock failed: ", err);
          }
        },
        addDevice: async (node) => {
          const res = await fetch('/api/device/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(node),
          });

          const {nodeDTO, params} = await res.json();

          set((state) => ({
            nodes: [...state.nodes, nodeDTO],
            params: [...state.params, ...params],
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

        deleteOptionParam: async (key) => {
          await fetch(`/api/device/param/${key}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });

          set((state) => ({
            params: state.params.filter(p => p.key !== key)
          }))
        },
        appOptionParam: async (param) => {
          const res = await fetch('/api/device/param/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(param),
          });

          const newParam = await res.json();

          set((state) => ({
            params: [...state.params, newParam]
          }));
        },
        removeParam: async (key: string) => {
          try {
            await fetch(`/api/device/param/${key}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            });

            set((state) => ({
              params: state.params.filter(p => p.key !== key),
            }));
          }  catch (err) {
            console.error('Ошибка при удалении параметра:', err);
            throw err; // чтобы компонент мог отреагировать
          }
        },
        updateParam: async (
          changes: { key: string; value: string }[]
        ) => {
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
          console.log(updatedList);
          type paramFromServer = {
            key: string;
            value: string;
          }

          set((state) => {
            // Обновляем существующие
            const merged = state.params.map((param) => {
              const upd = updatedList.find((u: paramFromServer) => u.key === param.key);
              return upd ? { ...param, value: upd.value } : param;
            });

            // Добавляем новые, которых не было
            const newParams = updatedList.filter((u: paramFromServer) => !state.params.some((p) => p.key === u.key));

            return {
              params: [...merged, ...newParams],
            };
          });
        },
        handleContextAction: async (action, nodeKey) => {
          if (action === 'delete') {
            if (!nodeKey) return;
            if (confirm('Удалить этот узел и все дочерние?')) {
              await get().removeDevice(nodeKey);
            }
          }
          if (action === 'add') {
            const title = prompt('Название нового узла:');
            if (title) {
              if (nodeKey) {
                const type = nodeKey.startsWith('dev') ? 'sub' : 'cha';
                const tempNode = {
                  type,
                  title,
                  isLeaf: type !== 'sub',
                  parentKey: nodeKey,
                };

                await get().addDevice(tempNode);
              } else {
                const tempNode = {
                  type: 'dev',
                  title,
                  isLeaf: false,
                  parentKey: null,
                };

                await get().addDevice(tempNode);
              }

            }
          }
          if (action === 'edit') {
            console.log('edit');
            // const newTitle = prompt('Новое название:', node.title.props.node.title);
            // if (newTitle) {
            //     console.log('edit');
            // }
          }
          get().setContextMenu(null);
        },
        handleContextParamAction: async (action, paramKey) => {
          if (action === 'delete') {
            if (paramKey) await get().deleteOptionParam(paramKey);
          }
          if (action === 'add') {
            const title = prompt('Название нового параметра:');
            if (title) {
              const newParam = {
                name: 'Общие параметры',
                value: title,
                parentKey: get().selectedDevice ?? ''
              };

              await get().appOptionParam(newParam);
            }
          }
          if (action === 'edit') {
            const title = prompt('Название параметра:');
            if (title && paramKey) {
              const changes = [{key: paramKey, value: title}];
              await get().updateParam(changes);
            }
          }
        }
      }),
      {
        name: 'device-store', // имя для persist (localStorage)
      },
    ),
  ),
);
