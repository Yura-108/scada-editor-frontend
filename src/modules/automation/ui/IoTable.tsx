"use client";

import React from "react";
import {ArrowLeftToLine, Plus, Trash2} from "lucide-react";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {AUTOMATION_VALUE_TYPES, type AutomationIo, type AutomationValueType} from "@/types/automation.types";
import {compactButton} from "./formStyles";
import {useDeviceTreeStore} from "@/core/devices";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {fieldLabelSmClass} from "@/shared/ui/field/fieldStyles";

interface Props {
  title: string;
  rows: AutomationIo[];
  onChange: (rows: AutomationIo[]) => void;
  /** Подпись пустого поля тега. У шаблона тега нет — там это «пример», а не «путь». */
  tagPlaceholder?: string;
}

/**
 * Входы или выходы задачи: alias для скрипта, путь тега ПЛК, тип значения.
 *
 * Переменную проекта сюда не подставляем: бэкенд отвергает тег `@var.*` во входах и выходах
 * (AutomationSetValidator.checkIo) — скрипт читает переменные через `vars`, пишет через `setVar`.
 */
export function IoTable({title, rows, onChange, tagPlaceholder}: Props) {
  const selectedDevice = useDeviceTreeStore(s => s.selectedDevice);

  const patch = (index: number, value: Partial<AutomationIo>) =>
    onChange(rows.map((row, i) => (i === index ? {...row, ...value} : row)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={fieldLabelSmClass}>{title}</span>
        <Button className={compactButton} onClick={() => onChange([...rows, {alias: "", tag: "", value_type: "float"}])}>
          <Plus size={14} />Добавить
        </Button>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr_auto_100px_auto] gap-2 items-center">
          <Input size="sm" placeholder="alias" value={row.alias} onChange={e => patch(i, {alias: e.target.value})} />
          <Input
            size="sm"
            /* Пример из шаблона — только подсказка: она исчезает, как только тег введён. */
            placeholder={row.example_tag || tagPlaceholder || "путь тега ПЛК"}
            value={row.tag}
            onChange={e => patch(i, {tag: e.target.value})}
            title={row.tag || (row.example_tag ? `Пример из шаблона: ${row.example_tag}` : undefined)}
          />
          <IconButton
            icon={ArrowLeftToLine}
            label="Подставить тег из дерева"
            variant="secondary"
            onClick={() => selectedDevice && patch(i, {tag: selectedDevice})}
            disabled={!selectedDevice}
            title={selectedDevice ? `Подставить ${selectedDevice}` : "Выберите тег в дереве справа"}
          />
          <Select
            size="sm"
            value={row.value_type}
            onValueChange={v => patch(i, {value_type: v as AutomationValueType})}
            options={AUTOMATION_VALUE_TYPES.map(t => ({value: t, label: t}))}
          />
          <IconButton icon={Trash2} label="Удалить строку" variant="danger" onClick={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
    </div>
  );
}
