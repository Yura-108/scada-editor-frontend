import type {LogEntry} from "../types/logs.type";

/**
 * Строки таблицы журнала: одиночная запись или операция — записи с одним `batchId`
 * (например, устройство и его параметры, созданные одним действием). Операция из одной записи
 * показывается как одиночная. Место группы — место её первой записи в списке (#14 п. 4).
 */
export type LogItem =
  | {kind: "single"; log: LogEntry}
  | {kind: "batch"; batchId: string; logs: LogEntry[]};

export function groupLogs(logs: LogEntry[]): LogItem[] {
  const byBatch = new Map<string, LogEntry[]>();
  for (const log of logs) {
    if (log.batchId == null) continue;
    const list = byBatch.get(log.batchId);
    if (list) list.push(log);
    else byBatch.set(log.batchId, [log]);
  }

  const items: LogItem[] = [];
  const placed = new Set<string>();
  for (const log of logs) {
    const batch = log.batchId != null ? byBatch.get(log.batchId) : undefined;
    if (!batch || batch.length < 2) {
      items.push({kind: "single", log});
      continue;
    }
    if (placed.has(log.batchId!)) continue;
    placed.add(log.batchId!);
    // Внутри операции — в порядке выполнения.
    const ordered = [...batch].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id - b.id);
    items.push({kind: "batch", batchId: log.batchId!, logs: ordered});
  }
  return items;
}
