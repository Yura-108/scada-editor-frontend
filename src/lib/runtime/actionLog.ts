/**
 * Журнал действий оператора (контракт docs/contract/2026-09-28-tag-archive-contract.md, раздел 5).
 */

export type ActionKind = "ACTION" | "PROCEDURE" | "TAG_WRITE";

export const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  ACTION: "Действие",
  PROCEDURE: "Процедура",
  TAG_WRITE: "Запись тегов",
};

export interface ActionLogRecord {
  /** ISO-8601. */
  ts: string;
  username: string | null;
  projectId: number | null;
  kind: ActionKind | string;
  componentId: number | null;
  component: string | null;
  /** Имя скрипта (ACTION), «операция рецепт» (PROCEDURE); null у TAG_WRITE. */
  target: string | null;
  /** Что пытались записать — только у TAG_WRITE. */
  tags: {tag: string; value: unknown}[] | null;
  outcome: "OK" | "ERROR" | string;
  /** Текст ошибки; у TAG_WRITE — теги, которые контроллер не подтвердил. */
  error: string | null;
}

export interface ActionLogFilter {
  from: number;
  to: number;
  projectId?: number | null;
  username?: string;
  kind?: ActionKind | "";
}

/** Одна страница журнала, новые сверху. */
export async function fetchActionLog(
  filter: ActionLogFilter,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<ActionLogRecord[]> {
  const q = new URLSearchParams({
    from: new Date(filter.from).toISOString(),
    to: new Date(filter.to).toISOString(),
    page: String(page),
    size: String(size),
  });
  if (filter.projectId != null) q.set("projectId", String(filter.projectId));
  if (filter.username?.trim()) q.set("username", filter.username.trim());
  if (filter.kind) q.set("kind", filter.kind);

  const res = await fetch(`/api/runtime/actions?${q}`, {signal});
  if (!res.ok) {
    const body = await res.json().catch(() => null) as {message?: string; error?: string} | null;
    throw new Error(body?.message || body?.error || `Журнал недоступен (${res.status})`);
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data as ActionLogRecord[] : [];
}
