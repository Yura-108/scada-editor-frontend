"use client";

import React from "react";
import {ArrowLeftToLine, Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {useDeviceStore} from "@/store/useDeviceStore";
import {AUTOMATION_VALUE_TYPES, type AutomationIo, type AutomationValueType} from "@/types/automation.types";

const cellInput = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  title: string;
  rows: AutomationIo[];
  onChange: (rows: AutomationIo[]) => void;
}

/**
 * Входы или выходы задачи: alias для скрипта, путь тега ПЛК, тип значения.
 *
 * Переменную проекта сюда не подставляем: бэкенд отвергает тег `@var.*` во входах и выходах
 * (AutomationSetValidator.checkIo) — скрипт читает переменные через `vars`, пишет через `setVar`.
 */
export function IoTable({title, rows, onChange}: Props) {
  const selectedDevice = useDeviceStore(s => s.selectedDevice);

  const patch = (index: number, value: Partial<AutomationIo>) =>
    onChange(rows.map((row, i) => (i === index ? {...row, ...value} : row)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">{title}</span>
        <Button onClick={() => onChange([...rows, {alias: "", tag: "", value_type: "float"}])}>
          <Plus size={14} />Добавить
        </Button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr_auto_100px_auto] gap-2 items-center">
          <input className={cellInput} placeholder="alias" value={row.alias} onChange={e => patch(i, {alias: e.target.value})} />
          <input className={cellInput} placeholder="путь тега ПЛК" value={row.tag} onChange={e => patch(i, {tag: e.target.value})} title={row.tag} />
          <Button
            onClick={() => selectedDevice && patch(i, {tag: selectedDevice})}
            disabled={!selectedDevice}
            title={selectedDevice ? `Подставить ${selectedDevice}` : "Выберите тег в дереве справа"}
          >
            <ArrowLeftToLine size={14} />
          </Button>
          <select className={cellInput} value={row.value_type} onChange={e => patch(i, {value_type: e.target.value as AutomationValueType})}>
            {AUTOMATION_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button onClick={() => onChange(rows.filter((_, j) => j !== i))} title="Удалить"><Trash2 size={14} /></Button>
        </div>
      ))}
    </div>
  );
}
