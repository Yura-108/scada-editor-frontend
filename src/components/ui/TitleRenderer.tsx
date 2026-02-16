import React, { memo } from 'react';
import { DeviceNodeType } from '@/types/nodeTypes';
import { cn } from '@/lib/utils';
import { Cpu, Folder, Hash, Radio, Settings, Pencil } from 'lucide-react';
import { useDeviceStore } from '@/store/useDeviceStore';

interface TitleRendererProps {
  node: DeviceNodeType;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent, node: DeviceNodeType) => void;
}

const getNodeType = (key: string): 'device' | 'subtype' | 'channel' => {
  if (key.startsWith('dev')) return 'device';
  if (key.startsWith('sub')) return 'subtype';
  if (key.startsWith('cha')) return 'channel';
  return 'subtype';
};

const NodeIcon = ({
  type,
  isLeaf,
}: {
  type: 'device' | 'subtype' | 'channel';
  isLeaf: boolean;
}) => {
  switch (type) {
    case 'device':
      return <Cpu className="w-5 h-5 text-indigo-600" />;
    case 'subtype':
      return isLeaf ? (
        <Hash className="w-5 h-5 text-purple-600" />
      ) : (
        <Folder className="w-5 h-5 text-purple-600" />
      );
    case 'channel':
      return <Radio className="w-5 h-5 text-emerald-600" />;
    default:
      return <Settings className="w-5 h-5 text-gray-500" />;
  }
};

const TitleRenderer: React.FC<TitleRendererProps> = memo(({
  node,
  onClick,
  onContextMenu,
}) => {
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const type = getNodeType(node.key);
  const isSelected = selectedDevice === node.key;
  const editingDevices = useDeviceStore((s) => s.editingDevices);
  const isEditing = editingDevices.includes(node.key);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm select-none cursor-pointer border',

        // ===== SELECTED =====
        isSelected
          ? type === 'device'
            ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
            : type === 'subtype'
              ? 'bg-purple-100 text-purple-800 border-purple-300'
              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : 'hover:bg-gray-50 text-gray-700 border-transparent',

        // ===== EDITING (накладывается поверх) =====

      )}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <NodeIcon type={type} isLeaf={node.isLeaf} />

      <span className="flex-1 truncate">{node.title}</span>

      {/* Канал */}
      {type === 'channel' && (
        <span className="text-xs opacity-70">канал</span>
      )}

      {/* Индикатор редактирования */}
      {isEditing && (
        <Pencil
          size={14}
          className="text-teal-600 opacity-70"
        />
      )}
    </div>
  );
});

export default TitleRenderer;
