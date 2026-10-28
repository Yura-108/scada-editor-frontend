import type {ProjectDataColumn, ProjectDataRow, ProjectDataTable} from "@/types/projectData.types";

/**
 * Разница двух версий «Данных проекта» — для вкладки «История таблиц» и предпросмотра
 * восстановления. Таблицы сопоставляются по имени (`name` уникально в наборе), строки — по `key`.
 */

/** Содержимое версии — снимок `ProjectDataSetDto`, той же формы, что у GET. Разбираем осторожно. */
export const tablesOfVersionContent = (content: unknown): ProjectDataTable[] | null => {
  if (!content || typeof content !== "object") return null;
  const tables = (content as {tables?: unknown}).tables;
  return Array.isArray(tables) ? (tables as ProjectDataTable[]) : null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface TableChange {
  name: string;
  /** Подпись таблицы из более новой версии. */
  title: string | null;
  lines: string[];
}

export interface DataVersionDiff {
  added: ProjectDataTable[];
  removed: ProjectDataTable[];
  changed: TableChange[];
}

const columnLabel = (c: ProjectDataColumn) => `${c.name}${c.title ? ` («${c.title}»)` : ""}: ${c.value_type}`;

const columnChanges = (before: ProjectDataColumn[], after: ProjectDataColumn[]): string[] => {
  const lines: string[] = [];
  const prev = new Map(before.map(c => [c.name, c]));
  const next = new Set(after.map(c => c.name));
  for (const c of after) {
    const old = prev.get(c.name);
    if (!old) {
      lines.push(`добавлена колонка ${columnLabel(c)}`);
      continue;
    }
    if (old.value_type !== c.value_type) lines.push(`колонка ${c.name}: тип ${old.value_type} → ${c.value_type}`);
    if ((old.title ?? "") !== (c.title ?? "")) lines.push(`колонка ${c.name}: подпись «${old.title ?? ""}» → «${c.title ?? ""}»`);
    if (old.required !== c.required) lines.push(`колонка ${c.name}: ${c.required ? "стала обязательной" : "стала необязательной"}`);
    if ((old.default_value ?? "") !== (c.default_value ?? "")) {
      lines.push(`колонка ${c.name}: значение по умолчанию «${old.default_value ?? ""}» → «${c.default_value ?? ""}»`);
    }
  }
  for (const c of before) if (!next.has(c.name)) lines.push(`удалена колонка ${columnLabel(c)}`);
  if (!lines.length && !same(before.map(c => c.name), after.map(c => c.name))) lines.push("изменён порядок колонок");
  return lines;
};

const rowChanges = (before: ProjectDataRow[], after: ProjectDataRow[]): string | null => {
  const prev = new Map(before.map(r => [r.key, r]));
  const nextKeys = new Set(after.map(r => r.key));
  let added = 0;
  let changed = 0;
  for (const row of after) {
    const old = prev.get(row.key);
    if (!old) added++;
    else if (!same(old.values, row.values)) changed++;
  }
  const removed = before.filter(r => !nextKeys.has(r.key)).length;
  if (!added && !removed && !changed) return null;
  const parts = [
    added ? `+${added} добавлено` : null,
    removed ? `−${removed} удалено` : null,
    changed ? `${changed} изменено` : null,
  ].filter(Boolean);
  return `строк: ${before.length} → ${after.length} (${parts.join(", ")})`;
};

export const diffDataVersions = (before: ProjectDataTable[] | null, after: ProjectDataTable[]): DataVersionDiff => {
  const prev = new Map((before ?? []).map(t => [t.name, t]));
  const nextNames = new Set(after.map(t => t.name));
  const added: ProjectDataTable[] = [];
  const changed: TableChange[] = [];
  for (const table of after) {
    const old = prev.get(table.name);
    if (!old) {
      added.push(table);
      continue;
    }
    const lines: string[] = [];
    if ((old.title ?? "") !== (table.title ?? "")) lines.push(`подпись: «${old.title ?? ""}» → «${table.title ?? ""}»`);
    if ((old.description ?? "") !== (table.description ?? "")) lines.push("изменено описание");
    lines.push(...columnChanges(old.columns, table.columns));
    const rows = rowChanges(old.rows, table.rows);
    if (rows) lines.push(rows);
    if (lines.length) changed.push({name: table.name, title: table.title, lines});
  }
  return {added, removed: (before ?? []).filter(t => !nextNames.has(t.name)), changed};
};

export const isEmptyDataDiff = (diff: DataVersionDiff) =>
  !diff.added.length && !diff.removed.length && !diff.changed.length;
