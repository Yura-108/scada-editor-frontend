"use client";

import React, {useEffect, useState} from "react";
import {Plus, Trash2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
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

/** Подпись поля: заметная на сером фоне страницы, а не бледная мелочь капслоком. */
export const fieldTitle = "block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1";

/** Пояснение под полем: что это и на что влияет. */
export const fieldHint = "text-xs text-neutral-500 dark:text-neutral-400 mt-1";

/** Компактные кнопки строк: размер `Button` по умолчанию рассчитан на подвал модалки. */
export const compactButton = "px-3 py-1.5 text-sm shadow-none whitespace-nowrap";
export const iconButton = "p-1.5 shadow-none";

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

/**
 * «Обязательна» стоит сразу за заголовком: так её ищут. Последняя колонка — ширина кнопки-иконки,
 * чтобы шапка совпадала с полями до пикселя.
 */
const GRID = "grid grid-cols-[minmax(120px,1fr)_minmax(140px,1fr)_120px_110px_minmax(120px,1fr)_32px] gap-2";

/** Шапка колонок: подпись и пояснение по наведению. `px-2` — как у поля, чтобы текст встал над текстом. */
const HEADERS: {title: string; hint: string}[] = [
  {title: "Имя", hint: "Имя колонки для скриптов: data('таблица', 'ключ').имя. Латиница, цифры и _."},
  {title: "Заголовок", hint: "Понятная людям подпись колонки — в шапке строк ниже. На скрипты не влияет."},
  {title: "Обязательна", hint: "В каждой строке должно быть значение (или значение по умолчанию). Это про значения, а не про заголовок."},
  {title: "Тип", hint: "Какие значения хранит колонка: число, строка, да/нет, JSON."},
  {title: "По умолчанию", hint: "Что получит скрипт, если в строке ячейка пустая."},
];

/** Колонки таблицы: имя, заголовок, обязательность, тип, значение по умолчанию. */
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
        <div>
          <h3 className="text-base font-semibold">Колонки</h3>
          <p className={fieldHint}>Из чего состоит каждая строка таблицы. Наведите на подпись колонки — появится пояснение.</p>
        </div>
        <Button className={compactButton} onClick={add}><Plus size={14} />Колонка</Button>
      </div>
      {columns.length > 0 && (
        <div className={cn(GRID, "rounded-lg bg-neutral-200/70 dark:bg-neutral-800 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200")}>
          {HEADERS.map(h => <span key={h.title} className="px-2 cursor-help" title={h.hint}>{h.title}</span>)}
          <span />
        </div>
      )}
      {columns.map((c, i) => (
        <div key={i} className={cn(GRID, "items-start")}>
          <ColumnNameInput name={c.name} taken={name => columns.some((o, j) => j !== i && o.name === name)} onCommit={name => rename(i, name)} />
          <input className={cellInput} value={c.title ?? ""} placeholder="как назвать для людей" onChange={e => patch(i, {title: e.target.value === "" ? null : e.target.value})} />
          <label className="flex items-center gap-2 h-[30px] px-2 text-sm cursor-pointer" title={HEADERS[2].hint}>
            <input type="checkbox" checked={c.required} onChange={e => patch(i, {required: e.target.checked})} />
            {c.required ? "да" : "нет"}
          </label>
          <select className={cellInput} value={c.value_type} onChange={e => retype(i, e.target.value as ProjectDataValueType)}>
            {PROJECT_DATA_VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className={cn(cellInput, "font-mono")}
            value={c.default_value ?? ""}
            placeholder={c.value_type === "json" ? "{}" : ""}
            onChange={e => patch(i, {default_value: e.target.value === "" ? null : e.target.value})}
          />
          <Button className={iconButton} onClick={() => remove(i)} title="Удалить колонку и её значения во всех строках"><Trash2 size={14} /></Button>
        </div>
      ))}
      {columns.length === 0 && <p className="text-xs text-neutral-500">Колонок нет — у строк будет только ключ.</p>}
      {errors.filter(e => e.field.startsWith("columns")).map((e, i) => (
        <p key={i} className="text-xs text-red-600">{e.field}: {e.message}</p>
      ))}
    </section>
  );
}
