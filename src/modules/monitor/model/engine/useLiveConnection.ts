import {useEffect, useRef, type Dispatch, type RefObject, type SetStateAction} from "react";
import {toast} from "sonner";
import {devLog} from "@/shared/lib/devLog";
import {describeDenial} from "@/core/access";
import {getOpenScene} from "@/core/project";
import {showRuntimeNotice, type ScreenPoint} from "@/core/runtime";
import {adoptProcedureStatuses, pushProcedureEvents} from "../useProcedureStore";
import {pushTaskStatuses, resetTaskStatuses} from "../useAutomationTasksStore";
import {openRuntimeConnection, type RuntimeConnection, type RuntimeStatus} from "./runtimeConnection";
import {ingestProperties, ingestTags, type EngineBuffers} from "./engineBuffers";
import {pushTrendPoints, rememberWireBools} from "./trendFeed";
import type {RuntimeMode} from "./useRuntimeEngine";
import type {SceneSubscription} from "./useSceneSubscription";

/** Тик применения батча: сервер и так батчит ~40мс, 5 Гц на рендер достаточно. */
const FLUSH_INTERVAL_MS = 200;
/** Соединение "live", но кадров нет дольше этого — считаем данные устаревшими
 *  (обрыв Kafka-консьюмера на бэкенде не рвёт WS, ts — единственный признак). */
const STALE_THRESHOLD_MS = 10_000;

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

interface Params {
  active: boolean;
  projectId: number | null;
  mode: RuntimeMode;
  buffers: EngineBuffers;
  connRef: RefObject<RuntimeConnection | null>;
  lastSubRef: RefObject<SceneSubscription | null>;
  actionPointsRef: RefObject<Map<number, ScreenPoint | undefined>>;
  flushRef: RefObject<() => void>;
  statusRef: RefObject<RuntimeStatus>;
  resetSessionState: () => void;
  setStatus: Dispatch<SetStateAction<RuntimeStatus>>;
  setStatusDetail: Dispatch<SetStateAction<string | null>>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setIsStale: Dispatch<SetStateAction<boolean>>;
}

/**
 * Живое соединение монитора: сессия runtime на пару (active, projectId), кадры в буферы,
 * тик flush и признак устаревших данных.
 */
export function useLiveConnection({
  active, projectId, mode, buffers, connRef, lastSubRef, actionPointsRef, flushRef, statusRef,
  resetSessionState, setStatus, setStatusDetail, setSessionId, setIsStale,
}: Params) {
  // Момент последнего непустого UPDATE-кадра — обрыв Kafka-консьюмера на бэкенде
  // не рвёт WS, поэтому статус может оставаться "live" при замерших значениях;
  // единственный признак — переставший расти ts/момент приёма кадра.
  const lastMessageAtRef = useRef(0);

  // Соединение живёт на пару (active, projectId) — смена сцены внутри проекта
  // его не пересоздаёт (индекс подменяется через ref).
  useEffect(() => {
    if (!active || projectId == null || mode !== "live") return;

    log(`движок запущен для проекта ${projectId}`);
    lastMessageAtRef.current = 0;
    // Статусы принадлежат проекту: задачи прошлого проекта в панели остаться не должны.
    resetTaskStatuses();

    const conn = openRuntimeConnection(projectId, {
      onTasks: pushTaskStatuses,
      /**
       * Выпуск, который крутит проект. Сменился (кадр TREE_CHANGED, либо prod переключили,
       * пока не было связи, — тогда другой номер приходит с новой сессией) — стор перечитывает
       * список и схему выпуска. Биндинги перезапустятся сами: смена `elements` пересобирает
       * индекс, а следом за TREE_CHANGED приходит SNAPSHOT.
       */
      onRelease: (versionNo, changed) => {
        const store = getOpenScene();
        const shown = store.releaseVersionNo;
        // TREE_CHANGED снял подписку на сервере: дальше снова идут все теги, а новую
        // подписку эффект подписки пошлёт, когда схема выпуска перерисуется.
        if (changed) lastSubRef.current = null;
        if (changed ||(shown !== null && shown !== versionNo)) void store.reloadRelease(versionNo);
        else store.setReleaseVersionNo(versionNo);
      },
      /**
       * Снимок состояния проекта при подключении. Идёт тем же путём, что телеметрия и
       * запись оператором: значения в buffers.pending, затем синхронный flush. Предзаписывать
       * buffers.values НЕЛЬЗЯ — no-op-страж во flush счёл бы изменение отсутствующим, и ни
       * одна привязка не сработала бы, то есть схема осталась бы в состоянии по умолчанию
       * поверх идущего процесса.
       */
      onSnapshot: (tags, properties, procedures) => {
        lastMessageAtRef.current = Date.now();
        ingestTags(buffers, tags);
        ingestProperties(buffers, properties);
        // Список активных процедур проекта ПОЛНЫЙ: отсутствие наблюдаемой в нём означает
        // «не запущена», а не «нет данных».
        adoptProcedureStatuses(procedures);
        rememberWireBools(tags);
        pushTrendPoints(tags);
        flushRef.current();
      },
      onUpdate: (tags, properties, procedures) => {
        if (tags.length || properties.length) lastMessageAtRef.current = Date.now();

        // События процедуры НЕ кладём в buffers.pending: тот буфер коалесцирует значения
        // (last-write-wins плюс guard «то же значение — пропустить»), и для событий это
        // неверно вдвойне — STEP_STARTED и STEP_COMPLETED с одинаковой нагрузкой
        // схлопнулись бы, WRITE_FAILED/STALLED потерялись бы вовсе, а задержка на такте
        // флаша сместила бы секундомер шага. Отдаём сразу.
        pushProcedureEvents(procedures);
        rememberWireBools(tags);
        pushTrendPoints(tags);
        // Несколько апдейтов одного тега в батче: Map даёт last-write-wins (см. ingestTags).
        ingestTags(buffers, tags);
        ingestProperties(buffers, properties);
      },
      // Сервер отклонил нажатие (права или уровень): сообщение там, где нажимали;
      // состояние элементов не трогаем — ACTION просто не выполнился.
      onActionDenied: denied => {
        const text = describeDenial(denied);
        const point = actionPointsRef.current.get(denied.scriptId);
        if (!showRuntimeNotice(text, point)) toast.warning(text);
      },
      onStatus: (s, detail) => {
        log(`статус соединения: ${s}${detail ? ` (${detail})` : ""}`);
        setStatus(s);
        // Пояснение хранится для любого статуса, а не только для отказа: у «Переподключение…»
        // оно называет недоступный экземпляр runtime. Нет пояснения — нет и старого текста.
        setStatusDetail(detail ?? null);
        setSessionId(connRef.current?.getSessionId() ?? null);
      },
    });
    connRef.current = conn;
    // Эффект подписки мог отработать раньше соединения (первый маунт, возврат из архива) —
    // соединение запомнит подписку и отправит её при открытии сокета.
    const sub = lastSubRef.current;
    if (sub) conn.subscribeScene(sub.sceneId, sub.wire);

    // Именно interval, а не rAF: rAF замерзает в фоновой вкладке, значения
    // копились бы без применения. Плюс мгновенный догон при возврате на вкладку.
    const timer = setInterval(() => flushRef.current(), FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) flushRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Отдельный редкий тик — не завязан на FLUSH_INTERVAL_MS, чтобы не пересчитывать
    // устаревание на каждый батч-рендер.
    const staleTimer = setInterval(() => {
      const stale = statusRef.current === "live"
        && lastMessageAtRef.current > 0
        && Date.now() - lastMessageAtRef.current > STALE_THRESHOLD_MS;
      setIsStale(prev => (prev === stale ? prev : stale));
    }, 1000);

    return () => {
      log(`движок остановлен для проекта ${projectId}, рантайм-карты очищены`);
      clearInterval(timer);
      clearInterval(staleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      conn.close();
      connRef.current = null;
      resetSessionState();
      setSessionId(null);
      setStatusDetail(null);
      setIsStale(false);
    };
  }, [
    // Ссылки и сеттеры стабильны — в списке ради exhaustive-deps; соединение живёт на
    // (active, projectId, mode).
    active, projectId, mode, resetSessionState, buffers,
    connRef, lastSubRef, actionPointsRef, flushRef, statusRef, setStatus, setStatusDetail, setSessionId, setIsStale,
  ]);
}
