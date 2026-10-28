import {create} from "zustand";
import type {ProcedureEvent, ProcedureStatus} from "@/types/recipe.types";
import {isProcedureAlert, isTerminalProcedureEvent} from "@/types/recipe.types";

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

  watch: (recipeId: string | null) => void;
  setStatus: (status: ProcedureStatus) => void;
  adoptStatuses: (statuses: ProcedureStatus[]) => void;
  applyEvents: (events: ProcedureEvent[]) => void;
  clearAlert: () => void;
  reset: () => void;
};

/** Чистое состояние — без него `watch`/`reset` расходились бы по полям. */
const empty = (): Pick<
  ProcedureState,
  "recipeId" | "status" | "stepStartedAt" | "events" | "lastAlert"
> => ({
  recipeId: null,
  status: null,
  stepStartedAt: null,
  events: [],
  lastAlert: null,
});

export const useProcedureStore = create<ProcedureState>((set, get) => ({
  ...empty(),

  watch: (recipeId) => set({...empty(), recipeId}),

  setStatus: (status) => set(state => ({
    status,
    // Секундомер перезапускаем только при смене шага: иначе редкая сверка со
    // `/status` дёргала бы отсчёт назад на величину задержки запроса.
    stepStartedAt: state.status?.stepIndex === status.stepIndex && state.stepStartedAt !== null
      ? state.stepStartedAt
      : Date.now() - status.elapsedMs,
  })),

  /**
   * Полный список активных процедур проекта — из кадра `SNAPSHOT` при подключении и из
   * сверки со `/status`. Список ПОЛНЫЙ, поэтому отсутствие наблюдаемого рецепта в нём
   * означает «не запущена», а не «нет данных»: иначе экран показывал бы давно завершённую
   * мойку как идущую.
   */
  adoptStatuses: (statuses) => {
    const {recipeId} = get();
    if (!recipeId) return;
    const mine = statuses.find(s => s.recipeId === recipeId);
    if (mine) get().setStatus(mine);
    else set({status: null, stepStartedAt: null});
  },

  applyEvents: (incoming) => {
    const {recipeId} = get();
    // В проекте может идти чужая процедура — берём только свою.
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
            paused: false,
            pauseReason: null,
          };
          stepStartedAt = Date.now();
        } else if (event.kind === "STALLED" && status) {
          status = {...status, stalled: true};
        } else if (event.kind === "PAUSED" && status) {
          // Причина приходит текстом события: «остановлена оператором» либо «авария: …».
          status = {...status, paused: true, pauseReason: event.message};
        } else if (event.kind === "RESUMED" && status) {
          status = {...status, paused: false, pauseReason: null};
        } else if (isTerminalProcedureEvent(event.kind)) {
          // У COMPLETED/ABORTED ни шага, ни его имени уже нет — не разыменовываем.
          status = status
            ? {...status, stepName: null, completed: true, stalled: false}
            : status;
          stepStartedAt = null;
        }
        if (isProcedureAlert(event.kind)) lastAlert = event;
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

/** Точка входа для кадра `SNAPSHOT`: статусы всех активных процедур проекта. */
export const adoptProcedureStatuses = (statuses: ProcedureStatus[]): void => {
  useProcedureStore.getState().adoptStatuses(statuses);
};
