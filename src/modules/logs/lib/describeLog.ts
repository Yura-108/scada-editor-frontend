import type {LogEntry} from "../types/logs.type";

/**
 * Запись журнала базы каналов — по-человечески (#14).
 *
 * Сервер (`channel`, `CommandLog`) присылает `commandType` вида `CREATE_NODE`, `UPDATE_PARAM`,
 * `DELETE_PARAM`, а запись об отмене — с приставкой `UNDO_`. Раньше фронт ждал `CREATE` /
 * `UPDATE` / `DELETE`: значок показывал сырое «UPDATE_PARAM», а «подробнее» не показывало
 * ничего. `payload` / `undoPayload` — снимки сущности: устройство `{id, idNode}`, параметр
 * `{id, idNode, idType, value}`, где `idNode` — путь устройства через точку. Создание кладёт
 * снимок в `payload`, удаление — в `undoPayload` (в `payload` только `{id}`), изменение —
 * «стало» в `payload`, «было» в `undoPayload`.
 */
export type LogAction = "CREATE" | "UPDATE" | "DELETE";

export interface LogKind {
  action: LogAction | null;
  target: "node" | "param";
  /** Запись об отмене другой записи (`UNDO_…`). */
  undo: boolean;
}

export const parseLogKind = (log: Pick<LogEntry, "commandType" | "entityType">): LogKind => {
  const m = /^(UNDO_)?(CREATE|UPDATE|DELETE)(?:_(NODE|PARAM))?$/.exec(String(log.commandType));
  const target = m?.[3] === "NODE" || (!m?.[3] && log.entityType === "Node") ? "node" : "param";
  return {action: (m?.[2] as LogAction | undefined) ?? null, target, undo: Boolean(m?.[1])};
};

const ACTION_LABEL: Record<LogAction, string> = {CREATE: "Создание", UPDATE: "Изменение", DELETE: "Удаление"};

/** Подпись значка операции: «Создание», «Отмена изменения»… */
export const logActionLabel = (kind: LogKind, raw: string): string => {
  if (!kind.action) return raw;
  const label = ACTION_LABEL[kind.action];
  return kind.undo ? `Отмена: ${label.toLowerCase()}` : label;
};

type Snapshot = Record<string, unknown>;

/** Снимок со смыслом: объект, в котором есть что-то кроме `id`. */
const meaningful = (value: unknown): Snapshot | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Snapshot;
  return Object.keys(obj).some(k => k !== "id") ? obj : null;
};

/** Было / стало. У создания «было» нет, у удаления нет «стало». */
export const logSides = (log: Pick<LogEntry, "payload" | "undoPayload">) => ({
  before: meaningful(log.undoPayload),
  after: meaningful(log.payload),
});

/** Путь устройства `BN1.Танки.TANK1` → `BN1 / Танки / TANK1`. */
export const devicePath = (idNode: unknown): string | null =>
  typeof idNode === "string" && idNode ? idNode.split(".").join(" / ") : null;

export type ParamTypeName = (idType: unknown) => string | null;

/** Что изменено: путь устройства и — у параметра — его тип. `null`, если снимков нет. */
export const logObjectTitle = (log: LogEntry, typeName: ParamTypeName): string | null => {
  const {before, after} = logSides(log);
  const snap = after ?? before;
  const path = devicePath(snap?.idNode);
  if (!path) return null;
  if (parseLogKind(log).target === "node") return path;
  const type = typeName(snap?.idType) ?? (snap?.idType != null ? `тип №${String(snap.idType)}` : "параметр");
  return `${path} · ${type}`;
};

const FIELD_LABEL: Record<string, string> = {
  idNode: "Устройство",
  idType: "Тип параметра",
  value: "Значение",
};

export interface LogFieldRow {
  label: string;
  before: string | null;
  after: string | null;
  changed: boolean;
}

/** Строки «поле — было — стало». Служебные поля (`id`) не показываются. */
export const logFieldRows = (log: LogEntry, typeName: ParamTypeName): LogFieldRow[] => {
  const {before, after} = logSides(log);
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
    .filter(k => k !== "id")
    .sort((a, b) => order(a) - order(b));
  const show = (key: string, snap: Snapshot | null): string | null => {
    if (!snap || !(key in snap)) return null;
    const v = snap[key];
    if (v === null || v === undefined || v === "") return "—";
    if (key === "idNode") return devicePath(v);
    if (key === "idType") return typeName(v) ?? `№${String(v)}`;
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };
  return keys.map(key => {
    const b = show(key, before);
    const a = show(key, after);
    return {label: FIELD_LABEL[key] ?? key, before: b, after: a, changed: Boolean(before && after) && a !== b};
  });
};

const ORDER = ["idNode", "idType", "value"];
const order = (key: string) => {
  const i = ORDER.indexOf(key);
  return i === -1 ? ORDER.length : i;
};

/** Одна строка для окна подтверждения: «Значение: было 5, станет 3». */
export const logRevertSummary = (log: LogEntry, typeName: ParamTypeName): string => {
  const kind = parseLogKind(log);
  const title = logObjectTitle(log, typeName) ?? `запись #${log.id}`;
  if (kind.undo) return `${title} — отмена уже применённой отмены`;
  if (kind.action === "CREATE") return `${title} — будет удалено`;
  if (kind.action === "DELETE") return `${title} — будет восстановлено`;
  const changes = logFieldRows(log, typeName)
    .filter(r => r.changed)
    .map(r => `${r.label}: было ${r.after ?? "—"}, станет ${r.before ?? "—"}`);
  return changes.length ? `${title} — ${changes.join("; ")}` : title;
};
