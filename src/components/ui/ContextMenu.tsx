"use client";

import React, {useRef} from "react";
import {useEffect} from "react";
import clsx from "clsx";
import {ContextMenuProps} from "@/types/contextMenu.type";
import { isEditingDevice } from "@/lib/useIsEditingDevice";

// Правильный тип для глобального обработчика
let globalContextMenuCloser: ((e: MouseEvent) => void) | null = null;

const ContextMenu = <T extends string = string>({
  menu,
  items,
  onAction,
  onClose
}: ContextMenuProps<T>) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu.visible) return;

    // Убираем предыдущий глобальный обработчик (если был)
    if (globalContextMenuCloser) {
      document.removeEventListener('contextmenu', globalContextMenuCloser);
    }

    // Новый обработчик: при следующем ПКМ — закрываем текущее меню
    const handleNextContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };

    globalContextMenuCloser = handleNextContextMenu;
    document.addEventListener('contextmenu', handleNextContextMenu);

    // Escape по-прежнему закрывает
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Очистка при размонтировании
    return () => {
      document.removeEventListener('contextmenu', handleNextContextMenu);
      document.removeEventListener('keydown', handleEscape);

      if (globalContextMenuCloser === handleNextContextMenu) {
        globalContextMenuCloser = null;
      }
    };
  }, [menu.visible, onClose]);
  // Клик вне меню — закрываем (по желанию, можно убрать, если мешает)
  useEffect(() => {
    if (!menu.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menu.visible, onClose]);

  if (!menu.visible) return null;

  const visibleItems = items.filter(item => {
    if (typeof menu.key === 'string') {
      if (isEditingDevice(menu.key)) {
        return (
          item.key !== 'edit' &&
          !(menu.key.startsWith('cha') && item.key === 'add')
        );
      }

      return item.key === 'edit';
    }

    return item.key === 'add';

  });

  if (visibleItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999]"
      style={{top: menu.y, left: menu.x}}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
        <div className="py-2 min-w-[180px]">
          {visibleItems.map((item) => (
            <React.Fragment key={item.key}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.disabled) {
                    onAction(item.action);
                    onClose();
                  }
                }}
                disabled={item.disabled}
                className={clsx(
                  'w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-left transition-all',
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-100',
                  item.disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
              {item.dividerAfter && <hr className="border-gray-200 mx-2"/>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContextMenu;