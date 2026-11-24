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
  /** Тип значения с бэкенда: int / float / bool / string. Старый бэкенд не присылает. */
  valueType?: string;
}