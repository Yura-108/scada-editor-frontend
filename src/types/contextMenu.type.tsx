import {ReactNode} from "react";

export type ContextMenuType = {
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
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem<T>[];
  onAction: (action: T) => void;
  onClose: () => void;
};