'use client';

import React, {useCallback, useMemo, useState} from 'react';
import Tree from 'rc-tree';
import {DataNode, Key} from 'rc-tree/es/interface';
import {Router} from 'lucide-react';
import {useDeviceStore} from '@/store/useDeviceStore';
import TitleRenderer from '@/components/ui/TitleRenderer';
import {DeviceNodeType} from '@/types/nodeTypes';
import SwitcherIcon from '@/components/ui/SwitcherIcon';
import ContextMenu from "@/components/ui/ContextMenu";
import {nodeMenuItems} from "@/constants/contextMenuItems";
import {ContextMenuTrigger, ContextMenuType} from "@/types/contextMenu.type";

const DeviceTreePanel = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuType | null>(null);
  const {
    nodes,
    selectedDevice,
    handleContextAction,
    isLoadingNodes,
    nodesError,
    loadedRootPath,
    loadNodes,
  } = useDeviceStore();
  const handleSelect = useCallback((keys: Key[]) => {
    const key = keys[0] as string | undefined;
    if (key) useDeviceStore.setState({selectedDevice: key});
  }, []);

  const handleNodeClick = (nodeKey: string) => {
    useDeviceStore.setState({selectedDevice: nodeKey});
  };

  const handleContextMenu = useCallback(
    (e: ContextMenuTrigger, node: DeviceNodeType | null) => {
      e.preventDefault();
      e.stopPropagation();

      if (node) {
        handleSelect([node.key]);

        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          key: node.key,
        });
      } else {
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          key: null
        })
      }

    },
    [handleSelect, setContextMenu] // зависимости
  );

  const treeData = useMemo(() => {
    const map = new Map<string, DataNode>();
    const roots: DataNode[] = [];

    nodes.forEach((n) => {
      const parts = n.key.split('.');
      let currentKey = '';

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const parentKey = currentKey;

        currentKey = currentKey ? `${currentKey}.${part}` : part;

        if (!map.has(currentKey)) {
          const nodeData = isLast ? n : { key: currentKey, title: part };

          // 1. Создаем объект узла без title, чтобы зафиксировать на него ссылку
          const newNode = {
            key: currentKey,
            children: [],
            isLeaf: true,
          } as DataNode;

          // 2. Добавляем title. При рендере эта функция прочитает финальный newNode.isLeaf
          newNode.title = () => (
            <TitleRenderer
              node={{ ...nodeData, isLeaf: newNode.isLeaf }}
              onClick={() => handleNodeClick(currentKey)}
              onContextMenu={handleContextMenu}
            />
          );

          map.set(currentKey, newNode);

          if (parentKey) {
            const parent = map.get(parentKey);
            if (parent) {
              parent.children!.push(newNode);
              parent.isLeaf = false; // Раз добавили ребенка, родитель перестает быть листом
            }
          } else {
            // Если родителя нет, значит это корень (например, site1)
            roots.push(newNode);
          }
        } else if (isLast) {
          // Если дошли до реального узла, который уже был создан как родительский
          const existingNode = map.get(currentKey)!;
          existingNode.title = () => (
            <TitleRenderer
              // Прокидываем данные n, но сохраняем актуальный isLeaf из existingNode
              node={{ ...n, isLeaf: existingNode.isLeaf }}
              onClick={() => handleNodeClick(currentKey)}
              onContextMenu={handleContextMenu}
            />
          );
        }
      });
    });

    return roots;
  }, [handleContextMenu, nodes]);

  // Ключи — это пути через точку (площадка.проект.устройство.канал), а тип узла
  // определяется его глубиной: L1 — площадка, L2 — проект, L3 — устройство,
  // L4+ — подустройства (узлы с детьми) и каналы/сигналы (листья).
  const {deviceCount, channelCount} = useMemo(() => {
    // Узел — лист, если ни один другой узел не ссылается на него как на родителя.
    const parentKeys = new Set(nodes.map((n) => n.parentKey).filter(Boolean));
    const depthOf = (key: string) => key.split('.').length;

    let devices = 0;
    let channels = 0;
    nodes.forEach((n) => {
      const depth = depthOf(n.key);
      const isLeaf = !parentKeys.has(n.key);

      if (depth >= 4 && isLeaf) {
        channels += 1; // конечный сигнал/канал
      } else if (depth >= 3) {
        devices += 1; // главное устройство или подустройство
      }
      // depth 1..2 — площадка/проект, в счётчики не входят
    });

    return {deviceCount: devices, channelCount: channels};
  }, [nodes]);

  return (
    <div className="h-[60vh] md:h-app bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 bg-linear-to-r from-purple-100 to-indigo-200 dark:from-purple-950/60 dark:to-indigo-950/60">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
          <Router className={'w-6 h-6 text-purple-600 dark:text-purple-400'}/>
          Дерево устройств
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {isLoadingNodes ? 'Загрузка…' : `${deviceCount} устройств • ${channelCount} каналов`}
        </p>
      </div>

      <div
        className="flex-1 overflow-y-auto custom-scrollbar px-2 py-4"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {/* Раньше во время загрузки дерево показывало «0 устройств • 0 каналов»,
            а ошибка загрузки была видна только в консоли. */}
        {isLoadingNodes ? (
          <div className="space-y-2 px-2" aria-busy="true" aria-label="Загрузка дерева устройств">
            {Array.from({length: 8}).map((_, i) => (
              <div
                key={i}
                className="h-6 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse"
                style={{width: `${90 - (i % 4) * 15}%`}}
              />
            ))}
          </div>
        ) : nodesError ? (
          <div className="mx-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
            <p className="font-medium">Не удалось загрузить дерево устройств</p>
            <p className="mt-1 break-words">{nodesError}</p>
            {loadedRootPath && (
              <button
                onClick={() => void loadNodes(loadedRootPath)}
                className="mt-3 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-red-500 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Повторить
              </button>
            )}
          </div>
        ) : treeData.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Дерево пусто — выберите площадку и проект ниже
          </div>
        ) : (
          <Tree
            treeData={treeData}
            showLine={false}
            showIcon={false}
            switcherIcon={SwitcherIcon}
            selectedKeys={selectedDevice ? [selectedDevice] : []}
            onSelect={handleSelect}
            defaultExpandAll={false}
            className="custom-tree"
          />
        )}

        {/* Контекстное меню */}
        {contextMenu && (
          <ContextMenu
            menu={contextMenu}
            items={nodeMenuItems}
            onAction={(action) => handleContextAction(action, contextMenu.key)}
            onClose={() => setContextMenu(null)}/>
        )}
      </div>
    </div>
  );
};

export default DeviceTreePanel;
