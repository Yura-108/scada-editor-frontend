'use client';

import {create} from 'zustand/react';
import {DeviceParamsType, DeviceParamsLayoutType} from '@/types/nodeTypes';
import {devtools} from 'zustand/middleware';
import {ContextMenuType} from "@/types/contextMenu.type";
import {DeviceAction, ParamAction} from "@/constants/contextMenuItems";
import {treeSearch} from "@/lib/treeSearch";
import {NodeParamType, NodeType} from "@/types/channelsTypes";
import {OpenCreateDeviveModal} from "@/components/ui/OpenCreateDeviceModal";
import {OpenCreateProjectModal, OpenCreateSiteModal} from "@/components/ui/OpenCreateContainerModal";
import {confirmModal, promptModal} from "@/components/ui/ConfirmModal";
import {toast} from "sonner";

/**
 * Разбирает ответ и бросает ошибку с сообщением бэкенда при не-2xx.
 *
 * Мутации базы каналов раньше вообще не проверяли `res.ok`: тело ошибки
 * парсилось как DTO и подмешивалось в состояние как настоящий узел
 * (`nodeDTO.key.split` падал с TypeError), либо изменение молча не применялось.
 */
const parseOk = async <T>(res: Response, fallback: string): Promise<T> => {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // тело не JSON — сообщение возьмём из текста
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && typeof (body as {message?: unknown}).message === "string"
        ? (body as {message: string}).message
        : "") || text.slice(0, 200) || `${fallback} (${res.status})`;
    throw new Error(message);
  }

  return body as T;
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

interface DeviceStoreState {
  nodes: NodeType[];
  params: NodeParamType[];

  // Какой rootPath сейчас загружен (для повторной синхронизации с бэкендом).
  loadedRootPath: string[] | null;
  // Данные базы каналов устарели и требуют пере-загрузки (например, после отмены действия в логах).
  isStale: boolean;
  markStale: () => void;
  refreshIfStale: () => Promise<void>;

  contextMenu: ContextMenuType | null;
  editingDevices: Array<string>;
  startEditing: (keys: string[]) => Promise<void>;
  stopEditing: (keys: string[]) => Promise<void>;
  toggleEditing: (key: string) => Promise<void>;
  setContextMenu: (menu: ContextMenuType | null) => void;
  selectedDevice: string | null;

  getParams(deviceKey: string | null): DeviceParamsType[];

  /** Идёт загрузка дерева устройств — панель показывает скелетон вместо «0 устройств». */
  isLoadingNodes: boolean;
  /** Текст последней ошибки загрузки дерева (для инлайн-плашки с кнопкой «Повторить»). */
  nodesError: string | null;

  loadNodes: (rootPath: string[]) => Promise<void>;
  getParamsTypes: () => Promise<void>;
  paramsTypes: DeviceParamsLayoutType[];
  deviceTemplateList: {templates: {key: number; value: string}[]};
  loadDeviceTemplateList: () => Promise<void>;
  addDevice: (node: {type: number; idNode: string; parentKey: string}) => Promise<void>;
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
      loadedRootPath: null,
      isStale: false,
      isLoadingNodes: false,
      nodesError: null,
      contextMenu: null,
      paramsTypes: [],
      // Тип — объект с полем templates; пустой массив здесь ронял
      // OpenCreateDeviceModal (`deviceTemplateList.templates.length`) с TypeError.
      deviceTemplateList: {templates: []},
      editingDevices: [],
      setContextMenu: (menu) => set({contextMenu: menu}),
      selectedDevice: null,
      markStale: () => set({isStale: true}),
      refreshIfStale: async () => {
        const {isStale, loadedRootPath} = get();
        // Грузим только если данные вообще были загружены и помечены устаревшими.
        if (!isStale || !loadedRootPath?.length) return;
        try {
          await get().loadNodes(loadedRootPath); // loadNodes сам сбросит isStale: false
        } catch (e) {
          console.error('Не удалось обновить базу каналов после отмены:', e);
          // isStale остаётся true — повторим при следующем входе
        }
      },
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
        set({isLoadingNodes: true, nodesError: null});
        try {
          const promises = rootPath.map(async (project) => {
            const res = await fetch(`/api/device/fullHierarchy?project=${encodeURIComponent(project)}`);

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

          // Гарантируем, что выбранные проекты присутствуют в дереве, даже если они пустые —
          // чтобы пустой проект всё равно отображался и в него можно было добавлять узлы.
          const existingKeys = new Set(processedNodes.map((n) => n.key));
          rootPath.forEach((projectKey) => {
            if (existingKeys.has(projectKey)) return;
            const parts = projectKey.split('.');
            const title = parts.pop() || '';
            const parentKey = parts.join('.');
            processedNodes.push({key: projectKey, title, parentKey});
          });

          const uniqueParams = Array.from(new Map(allParams.map(p => [p.key, p])).values());

          set({
            nodes: processedNodes,
            params: uniqueParams,
            loadedRootPath: rootPath,
            isStale: false,
          });
        } catch (error) {
          set({nodesError: errorMessage(error, 'Не удалось загрузить базу каналов')});
          toast.error(errorMessage(error, 'Не удалось загрузить базу каналов'));
          throw error;
        } finally {
          set({isLoadingNodes: false});
        }
      },
      loadDeviceTemplateList: async () => {
        try {
          const res = await fetch('/api/device/template');
          const data = await parseOk<{templates: {key: number; value: string}[]}>(
            res, 'Не удалось загрузить шаблоны устройств',
          );
          // Форма читает deviceTemplateList.templates.length — пустой массив вместо
          // объекта ронял модалку «Добавить» с TypeError.
          set({deviceTemplateList: data?.templates ? data : {templates: []}});
        } catch (err) {
          console.error('Ошибка загрузки шаблонов устройств:', err);
          toast.error(errorMessage(err, 'Не удалось загрузить шаблоны устройств'));
          set({deviceTemplateList: {templates: []}});
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

          const lockedDevices = await parseOk<string[]>(res, 'Не удалось начать редактирование');

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
          const res = await fetch(`api/unlock/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(keys),
          });

          const unlockedDevices = await parseOk<string[]>(res, 'Не удалось снять блокировку');

          set(state => ({
            editingDevices: state.editingDevices.filter(device => !unlockedDevices.includes(device)),
          }));
        } catch (err) {
          console.error("Unlock failed: ", err);
          toast.error(errorMessage(err, 'Не удалось завершить редактирование'));
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
        type ResponseType = {
          nodeDTO: NodeType;
          params: NodeParamType[];
        };

        let nodeDTO: NodeType;
        let params: NodeParamType[];
        try {
          const res = await fetch('/api/device/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(node),
          });
          ({nodeDTO, params} = await parseOk<ResponseType>(res, 'Не удалось создать узел'));
        } catch (err) {
          console.error('Ошибка при создании узла:', err);
          toast.error(errorMessage(err, 'Не удалось создать узел'));
          return;
        }

        const parts = nodeDTO.key.split('.');
        const title = parts.pop() || '';
        const parentKey = parts.join('.');

        const newNode = {
          key: nodeDTO.key,
          title: title,
          parentKey: parentKey,
        }

        set((state) => ({
          nodes: [...state.nodes, newNode],
          params: [...state.params, ...params],
        }));
      },
      removeDevice: async (key: string) => {
        try {
          const res = await fetch(`/api/device/${key}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
          });
          await parseOk(res, 'Не удалось удалить узел');
        } catch (err) {
          console.error('Ошибка при удалении узла:', err);
          toast.error(errorMessage(err, 'Не удалось удалить узел'));
          return;
        }

        set((state) => ({
          nodes: state.nodes.filter((n) => n.key !== key),
          params: state.params.filter((p) => p.parentKey !== key),
        }));
        toast.success('Узел удалён');
      },
      deleteOptionParam: async (key) => {
        try {
          const res = await fetch(`/api/device/param/${key}`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
          });
          await parseOk(res, 'Не удалось удалить параметр');
        } catch (err) {
          console.error('Ошибка при удалении параметра:', err);
          toast.error(errorMessage(err, 'Не удалось удалить параметр'));
          return;
        }

        set((state) => ({
          params: state.params.filter(p => p.key !== key)
        }))
      },
      addParam: async (param) => {
        let newParam: NodeParamType;
        try {
          const res = await fetch('/api/device/param/', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(param),
          });
          newParam = await parseOk<NodeParamType>(res, 'Не удалось добавить параметр');
        } catch (err) {
          console.error('Ошибка при добавлении параметра:', err);
          toast.error(errorMessage(err, 'Не удалось добавить параметр'));
          return;
        }

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
          const confirmed = await confirmModal({
            title: 'Удалить узел?',
            description: 'Узел и все дочерние элементы будут удалены. Действие необратимо.',
            confirmLabel: 'Удалить',
            danger: true,
          });
          if (confirmed) {
            await get().removeDevice(nodeKey);
          }
        }
        if (action === 'add_site') {
          OpenCreateSiteModal();
        }
        if (action === 'add_project') {
          if (!nodeKey) return;
          OpenCreateProjectModal(nodeKey);
        }
        if (action === 'add') {
          await get().loadDeviceTemplateList();
          if (!nodeKey) return;
          OpenCreateDeviveModal(nodeKey);
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
          const title = await promptModal({
            title: 'Новый параметр',
            label: 'Название параметра',
            placeholder: 'Например: Уставка давления',
            confirmLabel: 'Добавить',
          });
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
          const title = await promptModal({
            title: 'Переименовать параметр',
            label: 'Название параметра',
            confirmLabel: 'Сохранить',
          });
          if (title && paramKey) {
            const changes = [{key: paramKey, value: title}];
            await get().updateParam(changes);
          }
        }
      }
    }),
  ),
);
