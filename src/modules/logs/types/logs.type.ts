export interface LogEntry {
  id: number;
  userName: string;
  entityType: string;
  entityId: number;
  /**
   * `CREATE_NODE`, `UPDATE_PARAM`, `DELETE_PARAM`…, у записи об отмене — с `UNDO_`. Разбирает
   * `parseLogKind` (lib/describeLog): раньше здесь стояло `'CREATE' | 'UPDATE' | 'DELETE'`, и
   * ни одна настоящая запись под это не подходила.
   */
  commandType: string;
  payload: unknown;
  undoPayload: unknown;
  createdAt: string;
  // Идентификатор пакета (UUID): все записи, созданные одной операцией
  // (например, устройство + его параметры), имеют один batchId.
  // Отмена по batchId откатывает весь пакет разом.
  batchId?: string;
  // Порядковый номер записи внутри пакета.
  sequence?: number;
  // Время отмены записи (null/undefined — ещё не отменена).
  undoneAt?: string | null;
}