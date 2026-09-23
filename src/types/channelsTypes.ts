export type NodeType = {
  title: string
  key: string
  parentKey: string
}

export type NodeParamType = {
  key: string;
  parentKey: string;
  name: string;
  type: string;
  value: string;
}

/** Отчёт импорта .cdbx (POST /api/channel/import/cdbx). */
export type CdbxImportReport = {
  root: string;
  nodes: number;
  channels: number;
  /** Каналы, объединённые из двух групп (одна переменная ПЛК). */
  merged: string[];
  /** Каналы, у которых тип данных угадан (FLOAT). */
  guessedType: string[];
  /** Пропущенные имена. */
  skipped: string[];
  /** Объекты, не найденные в исходниках ПЛК и разложенные по общему правилу. */
  unmapped: string[];
}
