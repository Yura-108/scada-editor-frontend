'use client';

import React, {useMemo, useState} from 'react';
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
  const {nodes, selectedDevice, handleContextAction} = useDeviceStore();

  const handleSelect = (keys: Key[]) => {
    const key = keys[0] as string | undefined;
    if (key) useDeviceStore.setState({selectedDevice: key});
  };
  const handleNodeClick = (nodeKey: string) => {
    useDeviceStore.setState({selectedDevice: nodeKey});
  };
  const handleContextMenu = (e: React.MouseEvent, node: DeviceNodeType) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect([node.key]);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      key: node.key,
    });
  };

  const treeData = useMemo(() => {
    const map = new Map<string, DataNode>();

    nodes.forEach((n) => {
      map.set(n.key, {
        key: n.key,
        title: () => (
          <TitleRenderer
            node={n}
            onClick={() => handleNodeClick(n.key)}
            onContextMenu={handleContextMenu}
          />
        ),
        children: [],
        isLeaf: n.isLeaf,
      });
    });

    const roots: DataNode[] = [];
    nodes.forEach((n) => {
      if (n.parentKey) {
        const parent = map.get(n.parentKey);
        if (parent) parent.children!.push(map.get(n.key)!);
      } else {
        roots.push(map.get(n.key)!);
      }
    });

    return roots;
  }, [nodes]);

  return (
    <div className="h-full bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Router className={'w-6 h-6 text-purple-600'}/>
          Дерево устройств
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {nodes.filter((n) => !n.parentKey).length} устройств •{' '}
          {nodes.filter((n) => n.key.startsWith('cha')).length} каналов
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
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
        {/* Контекстное меню */}
        {contextMenu && (
          <ContextMenu
            visible={true}
            x={contextMenu.x}
            y={contextMenu.y}
            items={nodeMenuItems}
            onAction={(action) => handleContextAction(action, contextMenu.key)}
            onClose={() => setContextMenu(null)}/>
        )}
      </div>
    </div>
  );
};

export default DeviceTreePanel;
