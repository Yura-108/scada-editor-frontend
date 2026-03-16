export interface LogEntry {
  id: number;
  userName: string;
  entityType: string;
  entityId: number;
  commandType: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  undoPayload: any;
  createdAt: string;
}