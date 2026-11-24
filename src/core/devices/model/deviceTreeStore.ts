'use client';

import {create} from 'zustand/react';
import {devtools} from 'zustand/middleware';
import {toast} from "sonner";
import type {DeviceParamsType} from '../types/nodeTypes';
import type {NodeParamType, NodeType} from "../types/channelsTypes";
import {errorMessage} from "../api/devicesApi";
import {fetchDeviceTree} from "../api/deviceTreeApi";
import {useSessionUserStore} from "@/core/access";
import {rememberLoadedProjects} from "./loadedProjectsMemory";

/**
 * База каналов: дерево узлов и их параметры.
 *
 * Общая для «Каналов», редактора (выбор тегов, теги рецепта) и «Автоматизации»: дерево
 * грузится в «Каналах» и дальше читается всеми. Правка дерева — `deviceActions`,
 * блокировки — `deviceLocksStore`, справочники — `deviceDictionaries`, выбранный узел —
 * `deviceSelectionStore`.
 */
interface DeviceTreeState {
  nodes: NodeType[];
  params: NodeParamType[];

  // Какой rootPath сейчас загружен (для повторной синхронизации с бэкендом).
  loadedRootPath: string[] | null;
  // Данные базы каналов устарели и требуют пере-загрузки (например, после отмены действия в логах).
  isStale: boolean;
  markStale: () => void;
  refreshIfStale: () => Promise<void>;


  getParams(deviceKey: string | null): DeviceParamsType[];

  /** Идёт загрузка дерева устройств — панель показывает скелетон вместо «0 устройств». */
  isLoadingNodes: boolean;
  /** Текст последней ошибки загрузки дерева (для инлайн-плашки с кнопкой «Повторить»). */
  nodesError: string | null;

  loadNodes: (rootPath: string[]) => Promise<void>;
}

export const useDeviceTreeStore = create<DeviceTreeState>()(
  devtools(
    (set, get) => ({
      nodes: [],
      params: [],
      loadedRootPath: null,
      isStale: false,
      isLoadingNodes: false,
      nodesError: null,
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
      getParams: (deviceKey: string | null) => {
        if (!deviceKey) return [];
        return get().params.filter((param) => param.parentKey === deviceKey);
      },
      loadNodes: async (rootPath) => {
        set({isLoadingNodes: true, nodesError: null});
        try {
          const {nodes, params} = await fetchDeviceTree(rootPath);
          set({
            nodes,
            params,
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
    }),
  ),
);

// Загруженные проекты помнит вкладка: после F5 их снова грузит `useRestoreLoadedProjects`.
// Пишем на любую смену — «Загрузить», удаление проекта, повторная загрузка.
useDeviceTreeStore.subscribe((state, prev) => {
  if (state.loadedRootPath === prev.loadedRootPath) return;
  rememberLoadedProjects(useSessionUserStore.getState().login, state.loadedRootPath);
});
