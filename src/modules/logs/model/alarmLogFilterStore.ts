import {create} from "zustand";
import type {AlarmLogEvent, AlarmLogFilter} from "../alarmLog.types";

const DAY_MS = 24 * 3600_000;

/** `datetime-local` работает в местном времени без пояса. */
const toLocalInput = (ts: number) =>
  new Date(ts - new Date(ts).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * Форма журнала аварий — клиентское состояние, записи грузит Query (`useAlarmLog`). В сторе,
 * а не в странице: при возвращении в раздел форма и показанный период остаются прежними.
 */
interface AlarmLogFilterState {
  draftFrom: string;
  draftTo: string;
  projectId: number | null;
  group: string;
  event: AlarmLogEvent | "";
  /** Применённый фильтр; `null` — запроса ещё не было. */
  submitted: AlarmLogFilter | null;
  /** Ошибка проверки формы (до запроса). Ошибку сервера отдаёт Query. */
  validationError: string | null;

  setDraftFrom: (v: string) => void;
  setDraftTo: (v: string) => void;
  setProjectId: (v: number | null) => void;
  setGroup: (v: string) => void;
  setEvent: (v: AlarmLogEvent | "") => void;
  /**
   * Проверяет форму и делает фильтр применённым. `false` — фильтр тот же, что уже применён:
   * вызывающий перечитывает его сам («Показать» всегда идёт на сервер).
   */
  submit: () => boolean;
  /** Быстрый период «последние N»: до текущего момента. */
  applyPreset: (ms: number) => boolean;
  /**
   * Первый показ раздела — последние сутки. `projectId: null` — по всем проектам: это можно
   * только администратору, остальным бэкенд ответит 403, поэтому им передают проект.
   */
  ensureDefault: (projectId: number | null) => void;
}

const sameFilter = (a: AlarmLogFilter | null, b: AlarmLogFilter) =>
  a != null && a.from === b.from && a.to === b.to && a.projectId === b.projectId
  && a.group === b.group && a.event === b.event;

export const useAlarmLogFilterStore = create<AlarmLogFilterState>((set, get) => ({
  draftFrom: "",
  draftTo: "",
  projectId: null,
  group: "",
  event: "",
  submitted: null,
  validationError: null,

  setDraftFrom: v => set({draftFrom: v}),
  setDraftTo: v => set({draftTo: v}),
  setProjectId: v => set({projectId: v}),
  setGroup: v => set({group: v}),
  setEvent: v => set({event: v}),

  submit: () => {
    const {draftFrom, draftTo, projectId, group, event, submitted} = get();
    const from = new Date(draftFrom).getTime();
    const to = new Date(draftTo).getTime();
    if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
      set({validationError: "Начало периода должно быть раньше конца"});
      return true;
    }
    const next: AlarmLogFilter = {from, to, projectId, group, event};
    if (sameFilter(submitted, next)) {
      set({validationError: null});
      return false;
    }
    set({submitted: next, validationError: null});
    return true;
  },

  applyPreset: ms => {
    const now = Date.now();
    set({draftFrom: toLocalInput(now - ms), draftTo: toLocalInput(now)});
    return get().submit();
  },

  ensureDefault: projectId => {
    if (get().submitted) return;
    const now = Date.now();
    set({
      draftFrom: toLocalInput(now - DAY_MS),
      draftTo: toLocalInput(now),
      projectId,
      submitted: {from: now - DAY_MS, to: now, projectId, group: "", event: ""},
    });
  },
}));
