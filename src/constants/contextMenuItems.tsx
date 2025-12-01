// Где-то в компоненте с узлами
import {Copy, Edit3, Plus, Trash2} from "lucide-react";
import {ContextMenuItem} from "@/types/contextMenu.type";

export type DeviceAction = 'add' | 'delete' | 'edit';

export const nodeMenuItems: ContextMenuItem<DeviceAction>[] = [
  {
    key: 'add',
    label: 'Добавить Узел',
    icon: <Plus className="w-4 h-4" />,
    action: 'add',
    //hidden: key?.startsWith('cha'), // скрываем "Добавить" у дочерних
  },
  {
    key: 'edit',
    label: 'Редактировать',
    icon: <Edit3 className="w-4 h-4" />,
    action: 'edit',
  },
  {
    key: 'delete',
    label: 'Удалить',
    icon: <Trash2 className="w-4 h-4" />,
    action: 'delete',
    danger: true,
  },
];

export type ParamAction = 'edit' | 'duplicate' | 'delete' | 'copy-id';

export const paramMenuItems: ContextMenuItem<ParamAction>[] = [
  { key: 'edit', label: 'Редактировать', icon: <Edit3 className="w-4 h-4" />, action: 'edit' },
  { key: 'duplicate', label: 'Дублировать', icon: <Copy className="w-4 h-4" />, action: 'duplicate' },
  { key: 'copy-id', label: 'Копировать ID', action: 'copy-id' },
  { key: 'divider', label: '', dividerAfter: true, hidden: true, action: 'edit' }, // просто разделитель
  { key: 'delete', label: 'Удалить', icon: <Trash2 className="w-4 h-4" />, action: 'delete', danger: true },
];

