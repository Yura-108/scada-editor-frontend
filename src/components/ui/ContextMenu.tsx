"use client";

import React, {useRef} from "react";
import {useEffect} from "react";
import clsx from "clsx";
import {ContextMenuProps} from "@/types/contextMenu.type";
import { useEditingDevices } from "@/lib/useIsEditingDevice";

const ContextMenu = <T extends string = string>({
  menu,
  items,
  onAction,
  onClose
}: ContextMenuProps<T>) => {
  const menuRef = useRef<HTMLDivElement>(null);
  // Куда вернуть фокус после закрытия (строка дерева/параметра, с которой меню открыли).
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menu.visible) return;

    // ПКМ при открытом меню — закрыть его, а не открывать второе.
    // Раньше обработчик хранился в модульной переменной globalContextMenuCloser,
    // и два меню на странице затирали регистрацию друг друга.
    const handleNextContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('contextmenu', handleNextContextMenu);

    // Escape по-прежнему закрывает
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('contextmenu', handleNextContextMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menu.visible, onClose]);

  // Фокус уводим в меню при открытии и возвращаем обратно при закрытии:
  // иначе с клавиатуры до пунктов было не добраться, а после закрытия фокус
  // оставался на <body>.
  useEffect(() => {
    if (!menu.visible) {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
      return;
    }

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [menu.visible]);

  /** Стрелки/Home/End внутри меню (role="menu"). */
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const focusable = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (focusable.length === 0) return;

    const idx = focusable.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (idx + 1) % focusable.length;
    else if (e.key === 'ArrowUp') next = (idx - 1 + focusable.length) % focusable.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = focusable.length - 1;
    else if (e.key === 'Tab') {
      // Уход по Tab закрывает меню — так же ведут себя системные меню.
      onClose();
      return;
    }

    if (next < 0) return;
    e.preventDefault();
    focusable[next].focus();
  };
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

  const menuKey = menu.key;

  // Подписка на список редактируемых узлов: без неё открытое меню показывало
  // пункты по устаревшему состоянию блокировки.
  const editingDevices = useEditingDevices();
  const isEditing = (key: string) => editingDevices.includes(key);

  if (!menu.visible) return null;

  // Меню дерева устройств содержит пункты площадки/проекта; меню параметров — нет.
  // Логику по уровням применяем только к дереву, чтобы не сломать меню параметров.
  const isDeviceMenu = items.some(
    (i) => i.key === 'add_site' || i.key === 'add_project' || i.key === 'exit_edit'
  );

  const visibleItems = items.filter(item => {
    if (isDeviceMenu) {
      // Корень дерева (ПКМ по пустой области) — только «Добавить площадку»
      if (menuKey === null) {
        return item.key === 'add_site';
      }

      // Выбран узел: пункт добавления зависит от уровня вложенности
      const level = menuKey.split('.').length; // 1 — площадка, 2 — проект, 3+ — узел
      const isChannel = menuKey.startsWith('cha');
      const editing = isEditing(menuKey);

      switch (item.key) {
        case 'add_site':
          return false; // площадку добавляют только из корня
        case 'add_project':
          return level === 1; // проект — под площадкой
        case 'add':
          return level >= 2 && !isChannel; // узел — под проектом/узлом, но не под каналом
        case 'edit':
          return !editing;
        case 'exit_edit':
        case 'delete':
          return editing;
        default:
          return false;
      }
    }

    // Прочие меню (например, параметры) — прежнее поведение
    if (typeof menuKey === 'string') {
      if (isEditing(menuKey)) {
        return item.key !== 'edit' && !(menuKey.startsWith('cha') && item.key === 'add');
      }
      return item.key === 'edit';
    }
    return item.key === 'add';
  });

  if (visibleItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      aria-label="Контекстное меню"
      onKeyDown={handleMenuKeyDown}
      className="fixed z-dropdown"
      style={{top: menu.y, left: menu.x}}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
        <div className="py-2 min-w-[180px]">
          {visibleItems.map((item) => (
            <React.Fragment key={item.key}>
              <button
                role="menuitem"
                type="button"
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
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800',
                  item.disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
              {item.dividerAfter && (
                <hr role="separator" className="border-gray-200 dark:border-neutral-700 mx-2"/>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContextMenu;