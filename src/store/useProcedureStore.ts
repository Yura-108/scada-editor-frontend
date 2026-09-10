import {create} from "zustand";
import type {ProcedureEvent, ProcedureStatus} from "@/types/recipe.types";
import {isTerminalProcedureEvent} from "@/types/recipe.types";

/**
 * Состояние выполняющейся процедуры и журнал её событий.
 *
 * Отдельный стор, а не `runtimeEventBus`: тот устроен как набор ОДИНОЧНЫХ слотов
 * (`handler`, `tagWriteHandler`, `sessionGetter`…), где `set*` перезаписывает одну
 * модульную переменную — списка подписчиков там нет. Событиям процедуры нужно минимум
 * два потребителя (панель и уведомления об отказах записи), поэтому слот не годится.
 * Заодно события не тянут за собой перерисовку всего `MonitorClient`, чего не избежать,
 * положи мы их в `RuntimeEngineState`.
 */

/** Сколько последних событий держим — журнал нужен оператору, а не как архив. */
const MAX_EVENTS = 200;

type ProcedureState = {
  /** Рецепт, за которым сейчас следит панель. */
  recipeId: string | null;
  status: ProcedureStatus | null;
  /** Момент входа в текущий шаг: секундомер тикает на клиенте, а не запросами. */
  stepStartedAt: number | null;
  events: ProcedureEvent[];
  /** Последнее событие, о котором надо предупредить (WRITE_FAILED / STALLED). */
  lastAlert: ProcedureEvent | null;
  /**
   * Подсказка `resume-guess` — шаг, на котором процедура вероятно остановилась.
   * Живёт в сторе, а не в компоненте: её показывают и панель, и HUD над схемой, а спрашивает
   * её один общий `useProcedureSync`.
   */
  resumeHint: number | null;

  watch: (recipeId: string | null) => void;
  setStatus: (status: ProcedureStatus) => void;
  setResumeHint: (stepIndex: number | null) => void;
  applyEvents: (events: ProcedureEvent[]) => void;
  clearAlert: () => void;
  reset: () => void;
};

/** Чистое состояние — без него `watch`/`reset` расходились бы по полям. */
const empty = (): Pick<
  ProcedureState,
  "recipeId" | "status" | "stepStartedAt" | "events" | "lastAlert" | "resumeHint"
> => ({
  recipeId: null,
  status: null,
  stepStartedAt: null,
  events: [],
  lastAlert: null,
  resumeHint: null,
});

export const useProcedureStore = create<ProcedureState>((set, get) => ({
  ...empty(),

  watch: (recipeId) => set({...empty(), recipeId}),

  setResumeHint: (stepIndex) => set({resumeHint: stepIndex}),

  setStatus: (status) => set(state => ({
    status,
    // Статус пришёл — значит процедура в памяти рантайма есть, и подсказка неактуальна.
    resumeHint: null,
    // Секундомер перезапускаем только при смене шага: иначе редкая сверка со
    // `/status` дёргала бы отсчёт назад на величину задержки запроса.
    stepStartedAt: state.status?.stepIndex === status.stepIndex && state.stepStartedAt !== null
      ? state.stepStartedAt
      : Date.now() - status.elapsedMs,
  })),

  applyEvents: (incoming) => {
    const {recipeId} = get();
    // В сессии может идти чужая процедура — берём только свою.
    const mine = incoming.filter(e => e.recipeId === recipeId);
    if (!mine.length) return;

    set(state => {
      let status = state.status;
      let stepStartedAt = state.stepStartedAt;
      let lastAlert = state.lastAlert;

      for (const event of mine) {
        if (event.kind === "STEP_STARTED" && event.stepIndex != null) {
          status = {
            recipeId: event.recipeId,
            stepIndex: event.stepIndex,
            stepName: event.stepName,
            elapsedMs: 0,
            confirmed: false,
            completed: false,
            stalled: false,
          };
          stepStartedAt = Date.now();
        } else if (event.kind === "STALLED" && status) {
          status = {...status, stalled: true};
        } else if (isTerminalProcedureEvent(event.kind)) {
          // У COMPLETED/ABORTED ни шага, ни его имени уже нет — не разыменовываем.
          status = status
            ? {...status, stepName: null, completed: true, stalled: false}
            : status;
          stepStartedAt = null;
        }
        if (event.kind === "WRITE_FAILED" || event.kind === "STALLED") lastAlert = event;
      }

      return {
        status,
        stepStartedAt,
        lastAlert,
        events: [...state.events, ...mine].slice(-MAX_EVENTS),
      };
    });
  },

  clearAlert: () => set({lastAlert: null}),
  reset: () => set(empty()),
}));

/** Точка входа для движка рантайма: события кадра WS попадают сюда напрямую. */
export const pushProcedureEvents = (events: ProcedureEvent[]): void => {
  if (events.length) useProcedureStore.getState().applyEvents(events);
};
