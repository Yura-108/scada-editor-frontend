"use client";

import React, {useEffect, useState} from "react";
import {Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {cellInput, ColumnsEditor, nameHint} from "@/components/projectData/ColumnsEditor";
import {RowsGrid} from "@/components/projectData/RowsGrid";
import type {ProjectDataTable, ProjectDataValidationError} from "@/types/projectData.types";

const label = "block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1";

interface Props {
  tables: ProjectDataTable[];
  errors: ProjectDataValidationError[];
  onChange: (tables: ProjectDataTable[]) => void;
  onInvalidCountChange: (count: number) => void;
}

/**
 * Таблицы данных проекта. Порядок списка задаёт сервер (по алфавиту `title`); новая таблица
 * встаёт в конец и займёт своё место после сохранения.
 */
export function TablesEditor({tables, errors, onChange, onInvalidCountChange}: Props) {
  const [selected, setSelected] = useState(0);

  // Набор перечитали или таблицу удалили — выбор не должен указывать за конец списка.
  useEffect(() => {
    if (selected >= tables.length) setSelected(Math.max(0, tables.length - 1));
  }, [tables.length, selected]);

  const table = tables[selected];
  const errorsOf = (name: string) => errors.filter(e => e.table === name.trim());
  const tableErrors = table ? errorsOf(table.name) : [];

  const patch = (value: Partial<ProjectDataTable>) =>
    onChange(tables.map((t, i) => (i === selected ? {...t, ...value} : t)));

  const add = () => {
    let n = tables.length + 1;
    while (tables.some(t => t.name === `table_${n}`)) n++;
    onChange([...tables, {name: `table_${n}`, title: null, description: null, columns: [], rows: []}]);
    setSelected(tables.length);
  };

  const remove = async () => {
    if (!table) return;
    const ok = await confirmModal({
      title: `Удалить таблицу «${table.title ?? table.name}»?`,
      description: "Вместе с колонками и строками. Удаление применится при сохранении; "
        + "скрипты, читающие эту таблицу через data(), перестанут её находить.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    onChange(tables.filter((_, i) => i !== selected));
  };

  const duplicateName = table && tables.some((t, i) => i !== selected && t.name === table.name);
  const tableNameHint = table ? (duplicateName ? "такая таблица уже есть" : nameHint(table.name)) : null;

  return (
    <div className="flex-1 min-h-0 flex">
      <div className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-2 space-y-1">
        {tables.map((t, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={cn("w-full text-left px-3 py-2 rounded-lg text-sm", i === selected ? "bg-indigo-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          >
            <div className={cn("truncate", errorsOf(t.name).length > 0 && "text-red-600 dark:text-red-400")}>{t.title ?? t.name}</div>
            <div className="text-[11px] text-neutral-500 font-mono truncate">{t.name} · {t.rows.length} стр.</div>
          </button>
        ))}
        <Button className="w-full" onClick={add}><Plus size={14} />Таблица</Button>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {!table ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500">Таблиц нет</div>
        ) : (
          <div className="p-4 space-y-6 max-w-6xl">
            <div className="flex items-start gap-3">
              <div className="w-64">
                <label className={label}>Имя (для data())</label>
                <input
                  className={cn(cellInput, "font-mono", tableNameHint && "border-red-400 dark:border-red-500")}
                  value={table.name}
                  onChange={e => patch({name: e.target.value})}
                />
                {tableNameHint && <p className="text-[11px] text-red-600 mt-0.5">{tableNameHint}</p>}
              </div>
              <div className="flex-1">
                <label className={label}>Заголовок</label>
                <input className={cellInput} value={table.title ?? ""} onChange={e => patch({title: e.target.value === "" ? null : e.target.value})} />
              </div>
              <div className="pt-5">
                <Button variant="danger" onClick={() => void remove()}><Trash2 size={14} />Удалить</Button>
              </div>
            </div>
            <div>
              <label className={label}>Описание</label>
              <textarea
                className={cn(cellInput, "min-h-16")}
                value={table.description ?? ""}
                onChange={e => patch({description: e.target.value === "" ? null : e.target.value})}
              />
            </div>
            <p className="text-xs text-neutral-500 font-mono">
              data(&apos;{table.name}&apos;) · data(&apos;{table.name}&apos;, &apos;ключ&apos;) — только в серверных скриптах automation и runtime
            </p>
            {tableErrors.filter(e => e.field === "name").map((e, i) => (
              <p key={i} className="text-xs text-red-600">{e.message}</p>
            ))}

            <ColumnsEditor
              columns={table.columns}
              rows={table.rows}
              errors={tableErrors}
              onChange={(columns, rows) => patch({columns, rows})}
            />
            {/* key по таблице (и числу таблиц — после удаления под тем же индексом уже другая):
                ячейки держат свой текст, при смене таблицы он не должен переехать. */}
            <RowsGrid
              key={`${selected}/${tables.length}`}
              columns={table.columns}
              rows={table.rows}
              errors={tableErrors}
              onChange={rows => patch({rows})}
              onInvalidCountChange={onInvalidCountChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
