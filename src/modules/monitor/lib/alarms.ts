import type {ActiveAlarm, AlarmRef} from "../types";

/** Уникальный ключ аварии в проекте: `key` уникален только в пределах контроллера. */
export const alarmId = (a: AlarmRef): string => `${a.controllerId}/${a.key}`;

/**
 * Группа одинаковых сообщений: каждая попытка включить операцию — отдельная авария с тем же
 * текстом, и показывать их надо одним окном со счётчиком, а не стопкой одинаковых.
 */
export const alarmGroupKey = (a: ActiveAlarm): string =>
  JSON.stringify([a.controllerId, a.objectType, a.objectNumber, a.description]);

export interface AlarmGroup {
  groupKey: string;
  /** Новые сверху. */
  alarms: ActiveAlarm[];
  /** Самая новая авария группы — по ней текст, группа и время. */
  latest: ActiveAlarm;
  /** Самый важный приоритет в группе (меньше — важнее). */
  priority: number;
  /** Аварии, которые можно подтвердить. */
  ackable: ActiveAlarm[];
}

const byNewest = (a: ActiveAlarm, b: ActiveAlarm) => b.since - a.since;

/** Группы по важности, внутри одного приоритета — новые сверху. */
export function groupAlarms(list: readonly ActiveAlarm[]): AlarmGroup[] {
  const byKey = new Map<string, ActiveAlarm[]>();
  for (const a of list) {
    const k = alarmGroupKey(a);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(a);
    else byKey.set(k, [a]);
  }
  const groups: AlarmGroup[] = [];
  for (const [groupKey, bucket] of byKey) {
    const alarms = [...bucket].sort(byNewest);
    groups.push({
      groupKey,
      alarms,
      latest: alarms[0],
      priority: Math.min(...alarms.map(a => a.priority)),
      ackable: alarms.filter(a => a.ackable),
    });
  }
  return groups.sort((a, b) => a.priority - b.priority || b.latest.since - a.latest.since);
}

export type AlarmTone = "danger" | "warning" | "info";

/** ≤ 250 — тревога, ≤ 500 — сообщение, остальное — ответ на действие и напоминания. */
export function alarmTone(priority: number): AlarmTone {
  if (priority <= 250) return "danger";
  if (priority <= 500) return "warning";
  return "info";
}

/** Значок шапки: число аварий, ждущих подтверждения, и тон самой важной из них. */
export function alarmBadge(list: readonly ActiveAlarm[]): {count: number; tone: AlarmTone | null} {
  let count = 0;
  let top = Infinity;
  for (const a of list) {
    if (!a.ackable) continue;
    count += 1;
    top = Math.min(top, a.priority);
  }
  return {count, tone: count ? alarmTone(top) : null};
}

/** Не больше 100 аварий за запрос квитирования. */
export const ACK_BATCH_LIMIT = 100;

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Новые аварии относительно прежнего списка вкладки. `unseen` — аварии, которые оператор
 * ещё не закрыл: к ним добавляются новые, а ушедшие из списка выбрасываются.
 */
export function nextUnseen(
  prev: readonly ActiveAlarm[],
  next: readonly ActiveAlarm[],
  unseen: ReadonlySet<string>,
): Set<string> {
  const before = new Set(prev.map(alarmId));
  const out = new Set<string>();
  for (const a of next) {
    const id = alarmId(a);
    if (unseen.has(id) || !before.has(id)) out.add(id);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Время аварии: сегодняшние — «ЧЧ:ММ:СС», более старые — с датой. */
export function formatAlarmTime(since: number, now: number = Date.now()): string {
  const d = new Date(since);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return new Date(now).toDateString() === d.toDateString()
    ? time
    : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${time}`;
}
