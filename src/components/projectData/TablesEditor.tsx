"use client";

import React, {useEffect} from "react";
import {Plus} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {cellInput, ColumnsEditor, compactButton, fieldHint, fieldTitle, nameHint} from "@/components/projectData/ColumnsEditor";
import {RowsGrid} from "@/components/projectData/RowsGrid";
import type {ProjectDataTable, ProjectDataValidationError} from "@/types/projectData.types";

interface Props {
  tables: ProjectDataTable[];
  errors: ProjectDataValidationError[];
  onChange: (tables: ProjectDataTable[]) => void;
  onInvalidCountChange: (count: number) => void;
  /** Выбранная таблица живёт у страницы: «Удалить таблицу» стоит в её верхней панели. */
  selected: number;
  onSelect: (index: number) => void;
  /** Нет права правки: таблицы видны, поля заблокированы, добавлять нечего. */
  readOnly?: boolean;
}

/** Удаление выбранной таблицы с подтверждением; применится при сохранении. */
export async function confirmRemoveTable(tables: ProjectDataTable[], index: number): Promise<ProjectDataTable[] | null> {
  const table = tables[index];
  if (!table) return null;
  const ok = await confirmModal({
    title: `Удалить таблицу «${table.title ?? table.name}»?`,
    description: "Вместе с колонками и строками. Удаление применится при сохранении; "
      + "скрипты, читающие эту таблицу через data(), перестанут её находить.",
    confirmLabel: "Удалить",
    danger: true,
  });
  return ok ? tables.filter((_, i) => i !== index) : null;
}

/**
 * Таблицы данных проекта. Порядок списка задаёт сервер (по алфавиту `title`); новая таблица
 * встаёт в конец и займёт своё место после сохранения.
 */
export function TablesEditor({tables, errors, onChange, onInvalidCountChange, selected, onSelect: setSelected, readOnly = false}: Props) {
  // Набор перечитали или таблицу удалили — выбор не должен указывать за конец списка.
  useEffect(() => {
    if (selected >= tables.length) setSelected(Math.max(0, tables.length - 1));
  }, [tables.length, selected, setSelected]);

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

  const duplicateName = table && tables.some((t, i) => i !== selected && t.name === table.name);
  const tableNameHint = table ? (duplicateName ? "такая таблица уже есть" : nameHint(table.name)) : null;

  return (
    <div className="flex-1 min-h-0 flex">
      <div className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto p-2 pb-28 space-y-1">
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
        {!readOnly && <Button className={cn(compactButton, "w-full")} onClick={add}><Plus size={14} />Таблица</Button>}
      </div>

      {/* Список слева — вне fieldset: таблицы можно листать и в режиме просмотра. */}
      <fieldset disabled={readOnly} className="flex-1 min-w-0 m-0 p-0 border-0 overflow-y-auto">
        {!table ? (
          <div className="h-full flex items-center justify-center text-sm text-neutral-500">Таблиц нет</div>
        ) : (
          <div className="p-4 pb-28 space-y-6 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-4">
              <div>
                <label className={fieldTitle} htmlFor="table-name">Имя таблицы</label>
                <input
                  id="table-name"
                  className={cn(cellInput, "font-mono", tableNameHint && "border-red-400 dark:border-red-500")}
                  value={table.name}
                  onChange={e => patch({name: e.target.value})}
                />
                {tableNameHint
                  ? <p className="text-xs text-red-600 mt-1">{tableNameHint}</p>
                  : <p className={fieldHint}>Для скриптов: <code className="font-mono">data(&apos;{table.name}&apos;)</code>. Латиница, цифры и _.</p>}
              </div>
              <div>
                <label className={fieldTitle} htmlFor="table-title">Заголовок</label>
                <input
                  id="table-title"
                  className={cellInput}
                  value={table.title ?? ""}
                  placeholder="например: Уставки насосов"
                  onChange={e => patch({title: e.target.value === "" ? null : e.target.value})}
                />
                <p className={fieldHint}>Понятное людям название — так таблица подписана в списке слева. На работу скриптов не влияет.</p>
              </div>
            </div>
            <div>
              <label className={fieldTitle} htmlFor="table-description">Описание</label>
              <textarea
                id="table-description"
                className={cn(cellInput, "min-h-16")}
                value={table.description ?? ""}
                placeholder="что хранит таблица, кто и когда её заполняет"
                onChange={e => patch({description: e.target.value === "" ? null : e.target.value})}
              />
              <p className={fieldHint}>Заметка для коллег. Ни на что не влияет — только поясняет таблицу.</p>
            </div>
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
      </fieldset>
    </div>
  );
}
