'use client';

import {create} from 'zustand/react';
import {devtools} from 'zustand/middleware';
import {toast} from "sonner";
import type {DeviceParamsType} from '@/types/nodeTypes';
import type {NodeParamType, NodeType} from "@/types/channelsTypes";
import {errorMessage, fetchFullHierarchy, fetchSiteHierarchy} from "../api/devicesApi";

/**
 * База каналов: дерево узлов и их параметры, выбранный узел.
 *
 * Общая для «Каналов», редактора (выбор тегов, теги рецепта) и «Автоматизации»: дерево
 * грузится в «Каналах» и дальше читается всеми. Правка дерева — `deviceActions`,
 * блокировки — `deviceLocksStore`, справочники — `deviceDictionaries`.
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

  selectedDevice: string | null;

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
      getParams: (deviceKey: string | null) => {
        if (!deviceKey) return [];
        return get().params.filter((param) => param.parentKey === deviceKey);
      },
      loadNodes: async (rootPath) => {
        set({isLoadingNodes: true, nodesError: null});
        try {
          const results = await Promise.all(rootPath.map(fetchFullHierarchy));

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

          // Собственные параметры узла проекта fullHierarchy не отдаёт: его запрос — строго
          // `id_node LIKE 'root.%'`, то есть только потомки, сам корень в выдачу не попадает
          // (NodeRepository.findByIdNodeStartingWith). Добираем их по площадке через
          // `hierarchy` (прямые дети, ~2 КБ на площадку) — иначе у проекта не видно ни
          // «Источника импорта», ни любого другого его собственного параметра.
          const sites = Array.from(
            new Set(rootPath.map((p) => p.split('.')[0]).filter(Boolean)),
          );
          const siteParams: NodeParamType[] = [];
          await Promise.all(sites.map(async (site) => {
            try {
              const json = await fetchSiteHierarchy(site);
              if (!json) return;
              // Берём только выбранные проекты: у площадки в ответе есть и соседние,
              // а их узлов в дереве нет.
              siteParams.push(...(json.params ?? []).filter((p) => rootPath.includes(p.parentKey)));
            } catch {
              // Данные необязательные: дерево уже загружено, молча обходимся без них.
            }
          }));

          const uniqueParams = Array.from(
            new Map([...allParams, ...siteParams].map(p => [p.key, p])).values(),
          );

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
    }),
  ),
);
