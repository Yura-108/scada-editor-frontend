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
import {ContextMenuType} from "@/types/contextMenu.type";

const DeviceTreePanel = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuType | null>(null);
  const {
    nodes,
    selectedDevice,
    handleContextAction
  } = useDeviceStore();
  const handleSelect = useCallback((keys: Key[]) => {
    const key = keys[0] as string | undefined;
    if (key) useDeviceStore.setState({selectedDevice: key});
  }, []);

  const handleNodeClick = (nodeKey: string) => {
    useDeviceStore.setState({selectedDevice: nodeKey});
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: DeviceNodeType | null) => {
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

  // const handleAddDevice = async () => {
  //   await handleContextAction('add', null);
  // }

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

  return (
    <div className="h-full bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 bg-linear-to-r from-purple-100 to-indigo-200">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Router className={'w-6 h-6 text-purple-600'}/>
          Дерево устройств
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {nodes.filter((n) => !n.parentKey).length} устройств •{' '}
          {nodes.filter((n) => n.key.startsWith('cha')).length} каналов
        </p>
      </div>

      <div
        className="flex-1 overflow-y-auto custom-scrollbar p-2"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
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

        {/*<button*/}
        {/*  className={clsx(*/}
        {/*    "flex items-center gap-2 px-4 py-2 mt-2",*/}
        {/*    "hover:bg-gray-200",*/}
        {/*    "rounded-xl",*/}
        {/*    "text-sm text-gray-800 font-medium",*/}
        {/*    "transition-all duration-200",*/}
        {/*    "active:scale-95"*/}
        {/*  )}*/}
        {/*  onClick={handleAddDevice}*/}
        {/*>*/}
        {/*  <Plus size={18} />*/}
        {/*  Добавить устройство*/}
        {/*</button>*/}


        {/* Контекстное меню */}
        {contextMenu && (
          <ContextMenu
            menu={contextMenu}
            items={nodeMenuItems}
            onAction={(action) => handleContextAction(action, contextMenu.key ?? '')}
            onClose={() => setContextMenu(null)}/>
        )}
      </div>
    </div>
  );
};

export default DeviceTreePanel;
