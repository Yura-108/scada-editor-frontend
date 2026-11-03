import React, { memo } from 'react';
import { cn } from '@/shared/lib/cn';
import {
  Building2,
  FolderOpen,
  Cpu,
  Activity,
  Box,
  Pencil
} from 'lucide-react';
import {
  ContextMenuTrigger,
  contextMenuTriggerFromKey,
  isContextMenuKey,
} from '../types/contextMenu.type';
import {useDeviceLocksStore} from "../model/deviceLocksStore";
import {useDeviceSelection} from "../model/deviceSelectionStore";

interface TitleRendererProps {
  node: { key: string; title: string; isLeaf?: boolean };
  onClick: () => void;
  onContextMenu: (e: ContextMenuTrigger, node: TitleRendererProps["node"]) => void;
  /** Текущее совпадение поиска по дереву. Это не выбор: выбранный узел в модалке — выбранный тег. */
  highlighted?: boolean;
}

const NodeIcon = ({ depth, isLeaf }: { depth: number; isLeaf?: boolean }) => {
  if (!isLeaf && depth > 2) {
    return <FolderOpen className="w-5 h-5 text-warning" />;
  }

  // Логика по уровням вложенности
  switch (depth) {
    case 1:
      // Уровень 1: Площадка
      return <Building2 className="w-5 h-5 text-primary" />;
    case 2:
      // Уровень 2: Проект
      return <FolderOpen className="w-5 h-5 text-warning" />;
    case 3:
      // Уровень 3: Главное устройство
      return <Cpu className="w-5 h-5 text-info" />;
    default:
      // Уровень 4 и глубже (сабдевайсы, каналы)
      return isLeaf
        ? <Activity className="w-5 h-5 text-tag" /> // Конечный сигнал/канал
        : <Box className="w-5 h-5 text-muted-foreground" />;     // Промежуточный узел
  }
};

const TitleRenderer: React.FC<TitleRendererProps> = memo(({
  node,
  onClick,
  onContextMenu,
  highlighted = false,
}) => {
  const selectedDevice = useDeviceSelection((s) => s.selectedDevice);
  const editingDevices = useDeviceLocksStore((s) => s.editingDevices);

  const isSelected = selectedDevice === node.key;
  const isEditing = editingDevices.includes(node.key);

  // Вычисляем глубину узла на лету
  const depth = node.key.split('.').length;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-xl transition-all font-medium text-sm select-none cursor-pointer border',
        isSelected
          ? 'bg-primary/20 text-foreground border-primary/30 shadow-xs'
          : 'hover:bg-accent text-foreground border-transparent',
        // Без ветки «иначе»: её `border-transparent` шёл в cn последним и снимал рамку выбранного узла.
        isEditing && 'bg-linear-to-r from-success/15 via-success/5 to-transparent border-success/40',
        highlighted && 'ring-2 ring-warning',
      )}
      // По этому атрибуту панель дерева находит строку, чтобы прокрутить к найденному узлу.
      data-tree-key={node.key}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, node)}
      // Выделение узла и стрелки — забота rc-tree (у него свой role="treeitem"
      // на обёртке строки). Здесь добирается только контекстное меню: без этого
      // добавить/удалить узел можно было исключительно правой кнопкой мыши.
      onKeyDown={(e) => {
        if (!isContextMenuKey(e)) return;
        onContextMenu(contextMenuTriggerFromKey(e), node);
      }}
      title={`${node.title} — Shift+F10 открывает меню узла`}
    >
      <NodeIcon depth={depth} isLeaf={node.isLeaf} />

      <span className="flex-1 truncate">{node.title}</span>

      {/* Опционально: бейджик глубины. Очень помогает ориентироваться при бесконечной вложенности */}
      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
        L{depth}
      </span>

      {/* Индикатор редактирования */}
      {isEditing && (
        <Pencil
          size={14}
          className="text-success ml-2"
        />
      )}
    </div>
  );
});

TitleRenderer.displayName = "TitleRenderer";

export default TitleRenderer;

