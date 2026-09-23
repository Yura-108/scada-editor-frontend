import {Download, Edit3, Plus, Trash2} from "lucide-react";
import {ContextMenuItem} from "@/types/contextMenu.type";

export type DeviceAction =
  | 'add' | 'add_site' | 'add_project' | 'delete' | 'edit'
  | 'export_gateway' | 'delete_import';

export const nodeMenuItems: ContextMenuItem<DeviceAction>[] = [
  {
    key: 'add_site',
    label: 'Добавить площадку',
    icon: <Plus className="w-4 h-4" />,
    action: 'add_site',
  },
  {
    key: 'add_project',
    label: 'Добавить проект',
    icon: <Plus className="w-4 h-4" />,
    action: 'add_project',
  },
  {
    key: 'add',
    label: 'Добавить узел',
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
    key: 'exit_edit',
    label: 'Завершить редактирование',
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
  {
    key: 'export_gateway',
    label: 'Выгрузить для шлюза',
    icon: <Download className="w-4 h-4" />,
    action: 'export_gateway',
  },
  {
    key: 'delete_import',
    label: 'Удалить импортированный проект',
    icon: <Trash2 className="w-4 h-4" />,
    action: 'delete_import',
    danger: true,
  },
];

export type ParamAction = 'edit' | 'add' | 'delete';

export const paramMenuItems: ContextMenuItem<ParamAction>[] = [
  { key: 'add', label: 'Добавить', icon: <Plus className="w-4 h-4" />, action: 'add', hidden: false},
  { key: 'edit', label: 'Редактировать', icon: <Edit3 className="w-4 h-4" />, action: 'edit', hidden: false},
  { key: 'delete', label: 'Удалить', icon: <Trash2 className="w-4 h-4" />, action: 'delete', danger: true, hidden:false},
];

