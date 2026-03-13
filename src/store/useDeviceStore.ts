'use client';

import {create} from 'zustand/react';
import {DeviceNodeType, DeviceParamsType, DeviceTreeResponse, DeviceParamsLayoutType} from '@/types/nodeTypes';
import {devtools} from 'zustand/middleware';
import {ContextMenuType} from "@/types/contextMenu.type";
import {DeviceAction, ParamAction} from "@/constants/contextMenuItems";
import {treeSearch} from "@/lib/treeSearch";
import {NodeParamType, NodeType} from "@/types/channelsTypes";
interface DeviceStoreState {
  nodes: NodeType[];
  params: NodeParamType[];

  contextMenu: ContextMenuType | null;
  editingDevices: Array<string>;
  startEditing: (keys: string[]) => Promise<void>;
  stopEditing: (keys: string[]) => Promise<void>;
  toggleEditing: (key: string) => Promise<void>;
  setContextMenu: (menu: ContextMenuType | null) => void;
  selectedDevice: string | null;

  getParams(deviceKey: string | null): DeviceParamsType[];

  loadNodes: (rootPath: string[]) => Promise<void>;
  getParamsTypes: () => Promise<void>;
  paramsTypes: DeviceParamsLayoutType[];
  addDevice: (node: { type: string; title: string; isLeaf: boolean; parentKey: string | null }) => Promise<void>;
  removeDevice: (Key: string) => Promise<void>;
  deleteOptionParam: (key: string) => Promise<void>;
  removeParam: (key: string) => Promise<void>;
  addParam: (param: { id: number; value: string; parentKey: string }) => Promise<void>;
  updateParam: (value: { key: string; value: string }[]) => Promise<void>;
  handleContextAction: (action: DeviceAction, nodeKey: string | null) => Promise<void>;
  handleContextParamAction: (action: ParamAction, paramKey: string | null) => Promise<void>;
}

export const useDeviceStore = create<DeviceStoreState>()(
  devtools(
    (set, get) => ({
      nodes: [],
      params: [],
      contextMenu: null,
      paramsTypes: [],
      editingDevices: [],
      setContextMenu: (menu) => set({contextMenu: menu}),
      selectedDevice: null,
      getParamsTypes: async () => {
        const res = await fetch('/api/device/param/layout');
        const data: { descriptions: DeviceParamsLayoutType[] } = await res.json();

        set({paramsTypes: data.descriptions});
      },
      getParams: (deviceKey: string | null) => {
        if (!deviceKey) return [];
        return get().params.filter((param) => param.parentKey === deviceKey);
      },
      loadNodes: async (rootPath) => {
        try {
          const promises = rootPath.map(async (project) => {
            const res = await fetch(`/api/device/fullHierarchy?project=${project}`);

            if (!res.ok) {
              throw new Error(`Ошибка загрузки: ${project}`);
            }

            const json: {nodes: {key: string}[], params: NodeParamType[]} = await res.json();
            return json;
          });

          const results = await Promise.all(promises);

          const allRawNodes: { key: string }[] = [];
          const allParams: NodeParamType[] = [];

          results.forEach(res => {
            allRawNodes.push(...res.nodes);
            allParams.push(...res.params);
          });

          const processedNodes = allRawNodes.map(n => {
            const parts = n.key.split('.');
            const title = parts.pop() || '';
            const parentKey = parts.join('.');

            return {
              ...n,
              title,
              parentKey
            };
          });

          const uniqueParams = Array.from(new Map(allParams.map(p => [p.key, p])).values());

          set({
            nodes: processedNodes,
            params: uniqueParams,
          });
        } catch (error) {
          throw error;
        }
      },
      startEditing: async (keys: string[]) => {
        const {editingDevices} = get();
        const filteredKeys = keys.filter((key: string) => !editingDevices.includes(key));
        try {
          const res = await fetch(`api/lock/`, {
            method: 'POST',
            body: JSON.stringify(filteredKeys),
          });

          const lockedDevices = await res.json();

          set({
            editingDevices: [...editingDevices, ...lockedDevices],
          });
        } catch (err) {
          console.error("Lock failed: ", err);
        }
      },
      stopEditing: async (keys: string[]) => {
        try {
          const res = await fetch(`api/unlock/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(keys),
          });

          const unlockedDevices = await res.json();

          set(state => ({
            editingDevices: state.editingDevices.filter(device => !unlockedDevices.includes(device)),
          }));
        } catch (err) {
          console.error("Unlock failed: ", err);
        }
      },
      toggleEditing: (key: string) => {
        const editingTree = treeSearch(key, get().nodes) ?? [];
        const {editingDevices} = get();

        if (editingDevices.includes(key)) {
          void get().stopEditing(editingTree);
        } else {
          void get().startEditing(editingTree);
        }
      },
      addDevice: async (node) => {
        const res = await fetch('/api/device/', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
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
          headers: {'Content-Type': 'application/json'},
        });

        set((state) => ({
          nodes: state.nodes.filter((n) => n.key !== key),
          params: state.params.filter((p) => p.parentKey !== key),
        }));
      },
      deleteOptionParam: async (key) => {
        await fetch(`/api/device/param/${key}`, {
          method: 'DELETE',
          headers: {'Content-Type': 'application/json'},
        });

        set((state) => ({
          params: state.params.filter(p => p.key !== key)
        }))
      },
      addParam: async (param) => {
        const res = await fetch('/api/device/param/', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
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
            headers: {'Content-Type': 'application/json'},
          });

          set((state) => ({
            params: state.params.filter(p => p.key !== key),
          }));
        } catch (err) {
          console.error('Ошибка при удалении параметра:', err);
          throw err; // чтобы компонент мог отреагировать
        }
      },
      updateParam: async (changes: { key: string; value: string }[]) => {
        const res = await fetch('/api/device/param', {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({value: changes}),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.message || 'Ошибка сохранения параметров');
        }

        const updated = await res.json(); // ожидаем { value: [ { key, value }, ... ] }

        const updatedList = updated.value;

        type paramFromServer = {
          key: string;
          value: string;
        }

        set((state) => {
          // Обновляем существующие
          const merged = state.params.map((param) => {
            const upd = updatedList.find((u: paramFromServer) => u.key === param.key);
            return upd ? {...param, value: upd.value} : param;
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
          await get().toggleEditing(get().selectedDevice ?? '');
        }
        get().setContextMenu(null);
      },
      handleContextParamAction: async (action, paramKey) => {
        if (action === 'delete') {
          if (paramKey) await get().deleteOptionParam(paramKey);
        }
        if (action === 'add') {
          if (!get().selectedDevice) return;
          const id = get().paramsTypes.find(paramsType => paramsType.name === 'Общие параметры')?.id;
          const title = prompt('Название нового параметра:');
          if (title && id) {
            const newParam = {
              id: Number(id),
              value: title,
              parentKey: get().selectedDevice ?? ''
            };

            await get().addParam(newParam);
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
  ),
);
