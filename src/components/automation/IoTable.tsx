"use client";

import React, {useId} from "react";
import {ArrowLeftToLine, Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/Button";
import {useDeviceStore} from "@/store/useDeviceStore";
import {
  AUTOMATION_VALUE_TYPES,
  VARIABLE_TAG_PREFIX,
  type AutomationIo,
  type AutomationValueType,
  type AutomationVariable,
} from "@/types/automation.types";

const cellInput = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

interface Props {
  title: string;
  rows: AutomationIo[];
  /** Для подсказки `@var.<имя>` в поле тега — входом задачи может быть переменная проекта. */
  variables: AutomationVariable[];
  onChange: (rows: AutomationIo[]) => void;
}

/** Входы или выходы задачи: alias для скрипта, путь тега, тип значения. */
export function IoTable({title, rows, variables, onChange}: Props) {
  const selectedDevice = useDeviceStore(s => s.selectedDevice);
  // useId, а не title: подпись по-русски и с пробелами — плохой id для datalist.
  const listId = useId();

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
      <datalist id={listId}>
        {variables.map(v => <option key={v.name} value={`${VARIABLE_TAG_PREFIX}${v.name}`} />)}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr_auto_100px_auto] gap-2 items-center">
          <input className={cellInput} placeholder="alias" value={row.alias} onChange={e => patch(i, {alias: e.target.value})} />
          <input className={cellInput} placeholder="путь тега или @var.имя" list={listId} value={row.tag} onChange={e => patch(i, {tag: e.target.value})} title={row.tag} />
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
