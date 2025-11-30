'use client';

import { Edit3, Plus, Trash2 } from 'lucide-react';
import React, { useEffect } from 'react';
import clsx from 'clsx';

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  action: 'add' | 'edit' | 'delete';
  danger?: boolean;
};

const menuItems: MenuItem[] = [
  { label: 'Добавить дочерний', icon: <Plus className="w-4 h-4" />, action: 'add' },
  { label: 'Редактировать', icon: <Edit3 className="w-4 h-4" />, action: 'edit' },
  { label: 'Удалить', icon: <Trash2 className="w-4 h-4" />, action: 'delete', danger: true },
];

type NodeContextMenuProps = {
  visible: boolean;
  x: number;
  y: number;
  nodeKey: string | null;
  onAction: (action: 'add' | 'edit' | 'delete', nodeKey: string) => void;
  onClose: () => void;
};

const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  visible,
  x,
  y,
  nodeKey,
  onAction,
  onClose,
}) => {
  useEffect(() => {
    if (!visible) return;

    const handleClick = () => onClose();
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();

    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKey);
    };
  }, [visible, onClose]);

  if (!visible || !nodeKey) return null;

  return (
    <div className="fixed z-50" style={{ top: y, left: x }}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
        <div className="py-2">
          {menuItems.map((item) => (
            <button
              key={item.action}
              onClick={(e) => {
                e.stopPropagation();
                onAction(item.action, nodeKey);
                onClose();
              }}
              className={clsx(
                'w-full px-4 py-3 flex items-center gap-3 text-sm font-medium transition-all hover:bg-gray-100',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NodeContextMenu;
