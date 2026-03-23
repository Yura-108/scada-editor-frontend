import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  FolderOpen,
  Cpu,
  Activity,
  Box,
  Pencil
} from 'lucide-react';
import { useDeviceStore } from '@/store/useDeviceStore';

interface TitleRendererProps {
  node: { key: string; title: string; isLeaf?: boolean };
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent, node: any) => void;
}

const NodeIcon = ({ depth, isLeaf }: { depth: number; isLeaf?: boolean }) => {
  if (!isLeaf && depth > 2) {
    return <FolderOpen className="w-5 h-5 text-indigo-500" />;
  }

  // Логика по уровням вложенности
  switch (depth) {
    case 1:
      // Уровень 1: Площадка
      return <Building2 className="w-5 h-5 text-purple-600" />;
    case 2:
      // Уровень 2: Проект
      return <FolderOpen className="w-5 h-5 text-indigo-600" />;
    case 3:
      // Уровень 3: Главное устройство
      return <Cpu className="w-5 h-5 text-emerald-600" />;
    default:
      // Уровень 4 и глубже (сабдевайсы, каналы)
      return isLeaf
        ? <Activity className="w-5 h-5 text-teal-500" /> // Конечный сигнал/канал
        : <Box className="w-5 h-5 text-blue-500" />;     // Промежуточный узел
  }
};

const TitleRenderer: React.FC<TitleRendererProps> = memo(({
  node,
  onClick,
  onContextMenu,
}) => {
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const editingDevices = useDeviceStore((s) => s.editingDevices);

  const isSelected = selectedDevice === node.key;
  const isEditing = editingDevices.includes(node.key);

  // Вычисляем глубину узла на лету
  const depth = node.key.split('.').length;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-xl transition-all font-medium text-sm select-none cursor-pointer border',
        isSelected
          ? 'bg-indigo-200 text-indigo-900 border-indigo-200 shadow-xs'
          : 'hover:bg-gray-300 text-gray-700 border-transparent',
        isEditing
          ? 'bg-linear-to-r from-teal-50/40 via-teal-50/20 to-transparent border-teal-300/60 text-teal-900'
          : 'text-gray-700 border-transparent',
      )}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <NodeIcon depth={depth} isLeaf={node.isLeaf} />

      <span className="flex-1 truncate">{node.title}</span>

      {/* Опционально: бейджик глубины. Очень помогает ориентироваться при бесконечной вложенности */}
      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
        L{depth}
      </span>

      {/* Индикатор редактирования */}
      {isEditing && (
        <Pencil
          size={14}
          className="text-teal-600 ml-2"
        />
      )}
    </div>
  );
});

export default TitleRenderer;