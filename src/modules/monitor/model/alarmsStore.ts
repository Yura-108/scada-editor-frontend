import {useMemo} from "react";
import {create} from "zustand";
import type {ActiveAlarm} from "../types";
import {alarmBadge, alarmId, groupAlarms, nextUnseen, type AlarmGroup} from "../lib/alarms";

/**
 * Аварии ПЛК проекта, открытого в мониторе. Список приходит целиком (`SNAPSHOT.alarms`, а в
 * `UPDATE.alarms` — при изменении), поэтому стор его только заменяет.
 *
 * `unseen` — не производное значение, а память вкладки: какие аварии появились при открытом
 * мониторе и ещё не закрыты оператором. По ним всплывают окна.
 */
interface AlarmsState {
  /** Проект, которому принадлежит список. */
  projectId: number | null;
  alarms: ActiveAlarm[];
  /**
   * Пришёл ли первый список этого проекта. Аварии из него были до открытия монитора —
   * окнами не всплывают, только счётчик.
   */
  baseline: boolean;
  unseen: ReadonlySet<string>;
}

const EMPTY: AlarmsState = {projectId: null, alarms: [], baseline: false, unseen: new Set()};

export const useAlarmsStore = create<AlarmsState>(() => EMPTY);

/**
 * Новый полный список. После `TREE_CHANGED` и переподключения приходит новый `SNAPSHOT` —
 * он сравнивается с последним известным списком, поэтому уже показанные аварии повторно
 * окнами не всплывут.
 */
export function adoptAlarms(next: ActiveAlarm[]): void {
  useAlarmsStore.setState(state => (
    state.baseline
      ? {alarms: next, unseen: nextUnseen(state.alarms, next, state.unseen)}
      : {alarms: next, baseline: true, unseen: new Set()}
  ));
}

/** «Закрыть» и успешное квитирование: окна этих аварий больше не показываются. */
export function dismissAlarms(alarms: readonly ActiveAlarm[]): void {
  useAlarmsStore.setState(state => {
    const unseen = new Set(state.unseen);
    for (const a of alarms) unseen.delete(alarmId(a));
    return {unseen};
  });
}

/**
 * Соединение проекта открылось. Другой проект — следующий список снова станет базовым. Тот же
 * (переподключение, возврат из «Архива», возврат на страницу) — список помнится: аварии,
 * появившиеся за это время, должны всплыть окнами.
 */
export function bindAlarmsProject(projectId: number): void {
  if (useAlarmsStore.getState().projectId !== projectId) useAlarmsStore.setState({...EMPTY, projectId});
}

export function useAlarmGroups(): AlarmGroup[] {
  const alarms = useAlarmsStore(s => s.alarms);
  return useMemo(() => groupAlarms(alarms), [alarms]);
}

/** Группы, где есть хоть одна ещё не закрытая новая авария. */
export function usePopupGroups(): AlarmGroup[] {
  const groups = useAlarmGroups();
  const unseen = useAlarmsStore(s => s.unseen);
  return useMemo(
    () => groups.filter(g => g.alarms.some(a => unseen.has(alarmId(a)))),
    [groups, unseen],
  );
}

export function useAlarmBadge() {
  const alarms = useAlarmsStore(s => s.alarms);
  return useMemo(() => alarmBadge(alarms), [alarms]);
}

export function useAlarmsStale(): boolean {
  return useAlarmsStore(s => s.alarms.some(a => a.stale));
}

/** Проект, которому принадлежит список: до первого соединения нового проекта — прежний. */
export function useAlarmsProjectId(): number | null {
  return useAlarmsStore(s => s.projectId);
}
