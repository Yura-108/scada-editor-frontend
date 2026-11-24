/** Точка тренда. `value: null` — разрыв (недостоверное значение, обрыв связи). */
export interface TrendPoint {
  ts: number;
  value: number | null;
}

export interface ArchiveSeries {
  tag: string;
  /** Значение на момент `from` — с него линия начинается у левого края; null — его нет. */
  initial: TrendPoint | null;
  points: TrendPoint[];
  /** Числовой тег прорежен до min/max по корзинам. */
  aggregated: boolean;
}
