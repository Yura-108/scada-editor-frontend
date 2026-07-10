export interface LogEntry {
  id: number;
  userName: string;
  entityType: string;
  entityId: number;
  commandType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  undoPayload: any;
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