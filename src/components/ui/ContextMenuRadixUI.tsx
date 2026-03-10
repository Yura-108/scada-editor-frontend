import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';

export interface MenuItem {
  label: string;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

interface DynamicContextMenuProps {
  items: MenuItem[];
  children: React.ReactNode;
}

export const DynamicContextMenu = ({ items, children }: DynamicContextMenuProps) => {
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        {/* Radix автоматически вешает onContextMenu на этот элемент */}
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-40 bg-white rounded-md overflow-hidden p-1 shadow-xl border border-gray-200 z-[100]"
          //sideOffset={5}
        >
          {items.map((item, index) => (
            <ContextMenu.Item
              key={index}
              disabled={item.disabled}
              onClick={item.onClick}
              className={`
                group flex items-center px-3 py-2 text-sm outline-none cursor-default rounded-sm
                ${item.variant === 'danger' ? 'text-red-600 focus:bg-red-50' : 'text-gray-700 focus:bg-indigo-600 focus:text-white'}
                data-disabled:opacity-50
              `}
            >
              {item.label}
              {item.shortcut && (
                <span className="ml-auto pl-4 text-xs opacity-50 group-focus:text-white">
                  {item.shortcut}
                </span>
              )}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};