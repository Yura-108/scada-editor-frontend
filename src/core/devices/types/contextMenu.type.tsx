import {MouseEvent as ReactMouseEvent, ReactNode} from "react";

/**
 * Минимум, который нужен обработчику контекстного меню: точка открытия и гашение
 * события. `React.MouseEvent` подходит под этот тип как есть, но теперь меню
 * можно открыть и с клавиатуры (Shift+F10 / клавиша «Меню»), подставив координаты
 * из `getBoundingClientRect` — раньше такие меню были доступны только мышью.
 */
export type ContextMenuTrigger = Pick<
  ReactMouseEvent,
  "preventDefault" | "stopPropagation"
> & {
  clientX: number;
  clientY: number;
};

/** Нажатие, которое по системным соглашениям открывает контекстное меню. */
export const isContextMenuKey = (e: {key: string; shiftKey: boolean}) =>
  e.key === "ContextMenu" || (e.shiftKey && e.key === "F10");

/** Точка открытия меню для клавиатуры — левый нижний угол сфокусированной строки. */
export const contextMenuTriggerFromKey = (
  e: {preventDefault: () => void; stopPropagation: () => void; currentTarget: HTMLElement},
): ContextMenuTrigger => {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    preventDefault: () => e.preventDefault(),
    stopPropagation: () => e.stopPropagation(),
    clientX: rect.left + 8,
    clientY: rect.bottom,
  };
};

export type ContextMenuType = {
  visible: boolean;
  x: number;
  y: number;
  key: string | null;
}

export type ContextMenuItem<T extends string = string> = {
  key: string;
  label: string;
  icon?: ReactNode;
  action: T;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  dividerAfter?: boolean;
};

export type ContextMenuProps<T extends string = string> = {
  menu: ContextMenuType;
  items: ContextMenuItem<T>[];
  onAction: (action: T) => void;
  onClose: () => void;
  selectElement?: boolean;
};