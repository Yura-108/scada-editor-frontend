"use client";

import React, {useCallback, useEffect, useState} from "react";
import {Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {cellInput} from "@/components/projectData/ColumnsEditor";
import {formatCell, parseCell, setCellValue} from "@/lib/projectData/values";
import type {
  ProjectDataColumn,
  ProjectDataRow,
  ProjectDataValidationError,
} from "@/types/projectData.types";

interface Props {
  columns: ProjectDataColumn[];
  rows: ProjectDataRow[];
  errors: ProjectDataValidationError[];
  onChange: (rows: ProjectDataRow[]) => void;
  /** Сколько ячеек сейчас содержат неразбираемый текст — пока их больше нуля, сохранять нельзя. */
  onInvalidCountChange: (count: number) => void;
}

/**
 * Ячейка держит свой текст: число «1.» или недописанный JSON нельзя переформатировать
 * из значения на каждый символ. Валидный текст сразу уходит значением, невалидный остаётся
 * только в поле и помечается ошибкой.
 */
function Cell({column, value, missingRequired, onCommit, onInvalid}: {
  column: ProjectDataColumn;
  value: unknown;
  missingRequired: boolean;
  onCommit: (value: unknown) => void;
  onInvalid: (message: string | null) => void;
}) {
  const [draft, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Свой текст показывается, только пока ячейку правят или в ней ошибка; в остальное время —
  // само значение, так что смена типа колонки или перечитывание видны сразу.
  const text = focused || error ? draft : formatCell(value, column.value_type);

  // Ячейка исчезла (строку удалили, колонку переименовали) — её недописанный текст ушёл вместе
  // с ней, и сохранение он больше не блокирует.
  useEffect(() => () => onInvalid(null), [onInvalid]);

  const apply = (next: string) => {
    setText(next);
    const parsed = parseCell(next, column.value_type);
    if ("error" in parsed) {
      setError(parsed.error);
      onInvalid(parsed.error);
    } else {
      setError(null);
      onInvalid(null);
      onCommit(parsed.value);
    }
  };

  const className = cn(
    cellInput,
    "font-mono min-w-24",
    error ? "border-red-400 dark:border-red-500" : missingRequired && "border-amber-400 dark:border-amber-500",
  );
  const title = error ?? (missingRequired ? "Обязательная колонка без значения по умолчанию" : undefined);

  if (column.value_type === "bool") {
    return (
      <select className={className} value={text} title={title} onChange={e => apply(e.target.value)}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return (
    <input
      className={className}
      value={text}
      title={title}
      inputMode={column.value_type === "int" || column.value_type === "float" ? "decimal" : undefined}
      placeholder={column.default_value ?? ""}
      onFocus={() => {
        // Ячейка с ошибкой продолжает свой недописанный текст, остальные начинают со значения.
        if (!error) setText(formatCell(value, column.value_type));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={e => apply(e.target.value)}
    />
  );
}

/** Строки таблицы: ключ и по ячейке на колонку. */
export function RowsGrid({columns, rows, errors, onChange, onInvalidCountChange}: Props) {
  const [invalid, setInvalid] = useState<Record<string, string>>({});

  useEffect(() => { onInvalidCountChange(Object.keys(invalid).length); }, [invalid, onInvalidCountChange]);
  // Уход с таблицы теряет недописанный текст ячеек — блокировка сохранения уходит вместе с ним.
  useEffect(() => () => onInvalidCountChange(0), [onInvalidCountChange]);

  const markInvalid = useCallback((cellId: string, message: string | null) => {
    setInvalid(prev => {
      if (message === null) {
        if (!(cellId in prev)) return prev;
        const rest = {...prev};
        delete rest[cellId];
        return rest;
      }
      return prev[cellId] === message ? prev : {...prev, [cellId]: message};
    });
  }, []);

  // Колбэки ячеек стабильны по id: иначе cleanup-эффект ячейки срабатывал бы на каждый рендер.
  const [invalidHandlers] = useState(() => new Map<string, (message: string | null) => void>());
  const invalidHandler = (cellId: string) => {
    let handler = invalidHandlers.get(cellId);
    if (!handler) {
      handler = message => markInvalid(cellId, message);
      invalidHandlers.set(cellId, handler);
    }
    return handler;
  };

  const keyCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.key] = (acc[r.key] ?? 0) + 1;
    return acc;
  }, {});

  const patchRow = (index: number, row: ProjectDataRow) => onChange(rows.map((r, i) => (i === index ? row : r)));

  const addRow = () => {
    let n = rows.length + 1;
    while (rows.some(r => r.key === `row_${n}`)) n++;
    onChange([...rows, {key: `row_${n}`, values: {}}]);
  };

  // У строк нет своего id. Число строк в ключе перемонтирует ячейки после удаления или
  // добавления: иначе ячейка со сдвинутым индексом сохранила бы текст соседней строки.
  const rowKey = (index: number) => `${index}/${rows.length}`;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Строки <span className="text-neutral-500 font-normal">({rows.length})</span></h3>
        <Button onClick={addRow}><Plus size={14} />Строка</Button>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="text-sm border-separate border-spacing-1">
            <thead>
              <tr className="text-xs text-left text-neutral-500">
                <th className="font-medium px-1 min-w-32">key</th>
                {columns.map(c => (
                  <th key={c.name} className="font-medium px-1" title={`${c.name} · ${c.value_type}`}>
                    {c.title ?? c.name}{c.required && <span className="text-red-500">*</span>}
                    <span className="ml-1 text-[10px] text-neutral-400">{c.value_type}</span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const keyHint = row.key.trim() === "" ? "ключ не задан" : keyCounts[row.key] > 1 ? "ключ повторяется" : null;
                return (
                  <tr key={rowKey(ri)}>
                    <td className="align-top">
                      <input
                        className={cn(cellInput, "font-mono", keyHint && "border-red-400 dark:border-red-500")}
                        value={row.key}
                        title={keyHint ?? undefined}
                        onChange={e => patchRow(ri, {...row, key: e.target.value})}
                      />
                    </td>
                    {columns.map(c => (
                      <td key={c.name} className="align-top">
                        <Cell
                          column={c}
                          value={row.values[c.name]}
                          missingRequired={c.required && c.default_value === null && row.values[c.name] === undefined}
                          onCommit={value => patchRow(ri, setCellValue(row, c.name, value))}
                          onInvalid={invalidHandler(`${rowKey(ri)}|${c.name}`)}
                        />
                      </td>
                    ))}
                    <td className="align-top">
                      <Button onClick={() => onChange(rows.filter((_, i) => i !== ri))} title="Удалить строку"><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 0 && <p className="text-xs text-neutral-500">Строк нет.</p>}
      {Object.keys(invalid).length > 0 && (
        <p className="text-xs text-red-600">Есть ячейки с неверным значением ({Object.keys(invalid).length}) — сохранить нельзя, пока они не исправлены.</p>
      )}
      {errors.filter(e => e.field.startsWith("rows")).map((e, i) => (
        <p key={i} className="text-xs text-red-600">{e.field}: {e.message}</p>
      ))}
    </section>
  );
}
