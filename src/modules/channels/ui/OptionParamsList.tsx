'use client';

import React, {useState} from 'react';
import {clsx} from 'clsx';
import {
  contextMenuTriggerFromKey, DeviceContextMenu as ContextMenu, handleContextParamAction, isContextMenuKey,
  paramMenuItems, type ContextMenuTrigger, type ContextMenuType, type DeviceParamsType,
} from "@/core/devices";

/**
 * «Общие параметры» устройства (виджет option): единственное действие над строкой — меню
 * параметра по ПКМ, клавише меню, Shift+F10, Enter или пробелу.
 */
export function OptionParamsList({optionItems}: {optionItems: DeviceParamsType[]}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuType | null>(null);

  const handleContextMenu = (e: ContextMenuTrigger, key: string | null = null) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      key: key,
    });
  }

  return <>
    {/* Контекстное меню */}
    {contextMenu && (
      <ContextMenu
        selectElement={true}
        menu={contextMenu}
        items={paramMenuItems}
        onAction={(action) => handleContextParamAction(action, contextMenu?.key)}
        onClose={() => setContextMenu(null)}
      />
    )}
    {/* Общие параметры */}
    <div className='text-sm group relative flex flex-col justify-between transition-all duration-200 px-6 py-6 col-span-2'>
      <label className="block text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Общие параметры
      </label>
      <div
        onContextMenu={(e) => handleContextMenu(e, null)}
        className={"w-full h-48 overflow-y-auto pb-8 px-4 py-3 rounded-xl border border-gray-400 dark:border-neutral-700 bg-white dark:bg-neutral-950 transition-all text-gray-600 dark:text-gray-400 "}
      >
        {optionItems.map(p => (
          // Строка достижима с клавиатуры: единственное действие над ней —
          // контекстное меню, а раньше на ней висел только onContextMenu,
          // то есть без мыши параметр было не удалить.
          <div
            key={p.key}
            role="button"
            tabIndex={0}
            title="Правая кнопка мыши или Shift+F10 — меню параметра"
            onContextMenu={(e) => handleContextMenu(e, p.key)}
            onKeyDown={(e) => {
              if (isContextMenuKey(e) || e.key === "Enter" || e.key === " ") {
                handleContextMenu(contextMenuTriggerFromKey(e), p.key);
              }
            }}
            className={clsx(
              "text-gray-700 dark:text-gray-300 px-2 py-1 cursor-pointer transition-all duration-150 \n" +
              "    border-l-0 hover:border-l-4 hover:border-blue-500",
              contextMenu?.visible && contextMenu?.key === p.key ? "bg-blue-300 dark:bg-blue-500/40" : ""
            )}
          >
            {p.value}
          </div>
        ))}
      </div>
    </div>
  </>;
}
