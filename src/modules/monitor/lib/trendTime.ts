import {formatTrendTime} from "@/core/scene";
import type {TrendPoint} from "../model/archive/archive";

/** Значение пера в момент `ts`: последняя точка не позже него (архив хранит изменения). */
export function valueAt(points: readonly TrendPoint[], ts: number): number | null | undefined {
  let lo = 0;
  let hi = points.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].ts <= ts) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? points[ans].value : undefined;
}

/** `datetime-local` работает в местном времени без пояса. */
export const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

export const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("ru-RU")} ${formatTrendTime(ts, true)}`;
};
