"use client";

import React, {useEffect, useState} from "react";
import {Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {dropColumnFromRows, renameColumnInRows, retypeColumnInRows} from "@/lib/projectData/values";
import {
  PROJECT_DATA_NAME_RE,
  PROJECT_DATA_VALUE_TYPES,
  RESERVED_COLUMN_NAME,
  type ProjectDataColumn,
  type ProjectDataRow,
  type ProjectDataValidationError,
  type ProjectDataValueType,
} from "@/types/projectData.types";

export const cellInput = "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm";

/** Локальная подсказка к имени (таблицы или колонки) — до того, как это скажет бэкенд. */
export const nameHint = (name: string): string | null =>
  name === "" ? "имя не задано"
    : !PROJECT_DATA_NAME_RE.test(name) ? "латиница, цифры и _, не с цифры"
    : null;

interface Props {
  columns: ProjectDataColumn[];
  rows: ProjectDataRow[];
  errors: ProjectDataValidationError[];
  /** Колонки и строки меняются вместе: имя и тип колонки живут и в `rows[].values`. */
  onChange: (columns: ProjectDataColumn[], rows: ProjectDataRow[]) => void;
}

/**
 * Имя колонки применяется по blur/Enter, а не на каждый символ: переименование переносит
 * значения в строках, и промежуточное имя, совпавшее с соседней колонкой, склеило бы их данные.
 */
function ColumnNameInput({name, taken, onCommit}: {name: string; taken: (name: string) => boolean; onCommit: (name: string) => void}) {
  const [text, setText] = useState(name);
  const [collision, setCollision] = useState(false);
  useEffect(() => { setText(name); }, [name]);

  const commit = () => {
    const next = text.trim();
    if (next === name) { setText(name); return; }
    if (taken(next)) {
      setCollision(true);
      setText(name);
      return;
    }
    setCollision(false);
    onCommit(next);
  };

  const hint = collision ? "такая колонка уже есть"
    : text.trim() === RESERVED_COLUMN_NAME ? "«key» занято ключом строки"
    : nameHint(text.trim());

  return (
    <div>
      <input
        className={cn(cellInput, "font-mono", hint && "border-red-400 dark:border-red-500")}
        value={text}
        onChange={e => { setText(e.target.value); setCollision(false); }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      />
      {hint && <p className="text-[11px] text-red-600 mt-0.5">{hint}</p>}
    </div>
  );
}

const GRID = "grid grid-cols-[1fr_1fr_100px_90px_1fr_auto] gap-2";

/** Колонки таблицы: имя, заголовок, тип, обязательность, значение по умолчанию. */
export function ColumnsEditor({columns, rows, errors, onChange}: Props) {
  const patch = (index: number, value: Partial<ProjectDataColumn>) =>
    onChange(columns.map((c, i) => (i === index ? {...c, ...value} : c)), rows);

  const rename = (index: number, name: string) =>
    onChange(
      columns.map((c, i) => (i === index ? {...c, name} : c)),
      renameColumnInRows(rows, columns[index].name, name),
    );

  const retype = (index: number, value_type: ProjectDataValueType) =>
    onChange(
      columns.map((c, i) => (i === index ? {...c, value_type} : c)),
      retypeColumnInRows(rows, columns[index].name, value_type),
    );

  const remove = (index: number) =>
    onChange(columns.filter((_, i) => i !== index), dropColumnFromRows(rows, columns[index].name));

  const add = () => {
    let n = columns.length + 1;
    while (columns.some(c => c.name === `col_${n}`)) n++;
    onChange([...columns, {name: `col_${n}`, title: null, value_type: "string", required: false, default_value: null}], rows);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Колонки</h3>
        <Button onClick={add}><Plus size={14} />Колонка</Button>
      </div>
      {columns.length > 0 && (
        <div className={cn(GRID, "text-xs uppercase tracking-wider text-neutral-500")}>
          <span>Имя</span><span>Заголовок</span><span>Тип</span><span>Обязат.</span><span>По умолчанию</span><span />
        </div>
      )}
      {columns.map((c, i) => (
        <div key={i} className={cn(GRID, "items-start")}>
          <ColumnNameInput name={c.name} taken={name => columns.some((o, j) => j !== i && o.name === name)} onCommit={name => rename(i, name)} />
          <input className={cellInput} value={c.title ?? ""} onChange={e => patch(i, {title: e.target.value === "" ? null : e.target.value})} />
          <select className={cellInput} value={c.value_type} onChange={e => retype(i, e.target.value as ProjectDataValueType)}>
            {PROJECT_DATA_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center justify-center h-8">
            <input type="checkbox" checked={c.required} onChange={e => patch(i, {required: e.target.checked})} />
          </label>
          <input
            className={cn(cellInput, "font-mono")}
            value={c.default_value ?? ""}
            placeholder={c.value_type === "json" ? "{}" : ""}
            onChange={e => patch(i, {default_value: e.target.value === "" ? null : e.target.value})}
          />
          <Button onClick={() => remove(i)} title="Удалить колонку и её значения во всех строках"><Trash2 size={14} /></Button>
        </div>
      ))}
      {columns.length === 0 && <p className="text-xs text-neutral-500">Колонок нет — у строк будет только ключ.</p>}
      {errors.filter(e => e.field.startsWith("columns")).map((e, i) => (
        <p key={i} className="text-xs text-red-600">{e.field}: {e.message}</p>
      ))}
    </section>
  );
}
