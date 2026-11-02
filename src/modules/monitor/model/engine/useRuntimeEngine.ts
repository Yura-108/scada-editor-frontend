"use client";

import {devLog} from "@/shared/lib/devLog";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {adoptProcedureStatuses, pushProcedureEvents} from "../useProcedureStore";
import {pushTaskStatuses, resetTaskStatuses} from "../useAutomationTasksStore";
import {
  getSceneView, isBooleanValueType,
  trendPens, trendTiming, useSceneView,
} from "@/core/scene";
import {buildBindingIndex} from "./bindingIndex";
import {flushEngine} from "./flushEngine";
import {reseedScene} from "./sceneReseed";
import {useSceneSubscription, type SceneSubscription} from "./useSceneSubscription";
import {useRuntimeActions} from "./useRuntimeActions";
import {
  ingestProperties, ingestTags, isTagQualityGood,
  newEngineBuffers, resetArchiveBuffers, resetSessionBuffers,
} from "./engineBuffers";
import {showRuntimeNotice, type ScreenPoint} from "@/core/runtime";
import {toast} from "sonner";
import {describeDenial} from "@/core/access";
import {openRuntimeConnection, type RuntimeConnection, type RuntimeStatus} from "./runtimeConnection";
import {useRuntimeTagInterest} from "./runtimeTagInterest";
import {appendTrendPoints, clearTrendSeries, isTrendWatched, mergeTrendHistory, normalizeTs, resetTrendStore, setTrendClock, setTrendWatch, useTrendStore} from "@/core/canvas";
import {fetchArchiveValues, toTrendValue} from "../archive/archive";
import {useOpenScene, getOpenScene} from "@/core/project";

/** Тик применения батча: сервер и так батчит ~40мс, 5 Гц на рендер достаточно. */
const FLUSH_INTERVAL_MS = 200;
/** Соединение "live", но кадров нет дольше этого — считаем данные устаревшими
 *  (обрыв Kafka-консьюмера на бэкенде не рвёт WS, ts — единственный признак). */
const STALE_THRESHOLD_MS = 10_000;

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

/**
 * Точки трендов из кадра WS. Идут МИМО pendingRef/flush — тот буфер коалесцирует значения
 * (last-write-wins и страж «то же значение»), а тренду нужна каждая смена со своим
 * временем: два изменения в одном такте флаша иначе слились бы в одно.
 */
const pushTrendPoints = (tags: readonly {tagId: string; value: string | null; ts?: number; quality?: string}[]) => {
  const now = Date.now();
  const points: {tag: string; ts: number; value: number | null}[] = [];
  for (const t of tags) {
    if (!isTrendWatched(t.tagId)) continue;
    const value = toTrendValue(t.value, isTagQualityGood(t.quality));
    if (value === undefined) continue;
    points.push({tag: t.tagId, ts: normalizeTs(t.ts, now), value});
  }
  appendTrendPoints(points);
};

/**
 * Теги, которые по WS приходили как `"true"`/`"false"`. Архив хранит bool числом 1/0, и
 * вернуть ему вид WS можно, только зная, что тег дискретный (см. archiveValueToWire).
 * Модульный — переживает переподключение и смену режима в пределах вкладки.
 */
const wireBoolTags = new Set<string>();
const rememberWireBools = (tags: readonly {tagId: string; value: string | null}[]) => {
  for (const t of tags) if (t.value === "true" || t.value === "false") wireBoolTags.add(t.tagId);
};

/** Изменение тега из архива — уже в виде WS (строка), с качеством и временем. */
export interface ArchiveTagChange {
  tag: string;
  value: string | null;
  good: boolean;
  ts: number;
}

/** Вход движка для воспроизведения архива (режим `archive`). */
export interface RuntimeArchiveInput {
  /** Начать с чистого листа на момент `at`: значения, состояния, серии трендов. */
  reset: (at: number) => void;
  /** Применить изменения одним тиком — тем же путём, что кадр WS. */
  apply: (changes: readonly ArchiveTagChange[]) => void;
  /** Все теги открытой схемы — их и просим у архива. */
  sceneTags: string[];
  /** Дискретный ли тег (для обратного приведения 1/0 → "true"/"false"). */
  isBoolTag: (tag: string) => boolean;
  /** Проект монитора: ленту архива runtime проверяет по его prod-выпуску. */
  projectId: number | null;
}

/** Источник значений: живой WS или воспроизведение архива. */
export type RuntimeMode = "live" | "archive";

export interface RuntimeEngineState {
  status: RuntimeStatus;
  /** binding.id → ошибка компиляции (биндинг не участвует в рантайме). */
  compileErrors: Map<string, string>;
  /** binding.id → последняя ошибка исполнения (после 5 подряд — автоотключение). */
  runtimeErrors: Map<string, string>;
  /** id текущей WS-сессии (для GET /snapshot) — null, пока не подключены. */
  sessionId: string | null;
  /**
   * Пояснение к текущему статусу, когда оно есть: причина отказа при `rejected`
   * (проект не в эксплуатации, не назначен экземпляру, `e.reason` кода 1003) и причина
   * паузы при `reconnecting` (недоступный экземпляр runtime).
   */
  statusDetail: string | null;
  /** true — соединение "live", но кадров нет дольше STALE_THRESHOLD_MS (см. useRuntimeEngine.ts). */
  isStale: boolean;
  /** Подписка соединения на статусы задач automation (переживает переподключение). */
  subscribeTasks: () => void;
  unsubscribeTasks: () => void;
  archive: RuntimeArchiveInput;
}

/**
 * Движок биндингов режима монитора: держит рантайм-сессию (raw WS через gateway),
 * коалесирует входящие значения тегов (last-write-wins на тег), тикает 5 Гц и
 * применяет интенты одним applyRuntimeBatch (один set() → один ре-рендер сцены,
 * сколько бы тегов ни изменилось). elements не мутируются — ни undo, ни автосейв
 * рантайм не видят.
 */
export function useRuntimeEngine(active: boolean, mode: RuntimeMode = "live"): RuntimeEngineState {
  const elements = useSceneView(s => s.elements);
  const projectId = useOpenScene(s => s.currentProject?.id ?? null);

  const [status, setStatus] = useState<RuntimeStatus>("closed");
  const [runtimeErrors, setRuntimeErrors] = useState<Map<string, string>>(new Map());
  // Зеркало runtimeErrors для прогонов вне рендера. Без него flush пришлось бы держать
  // runtimeErrors в deps (пересоздание колбэка на каждую ошибку), а повторный прогон из
  // эффекта читал бы устаревшую карту из замыкания.
  const runtimeErrorsRef = useRef(runtimeErrors);
  const publishRuntimeErrors = useCallback((next: ReadonlyMap<string, string>) => {
    const prev = runtimeErrorsRef.current;
    // Та же карта либо «пусто было, пусто и осталось» — лишний setState перерисовал бы
    // шапку монитора на каждом тике и на каждом открытии схемы без единой ошибки.
    if (next === prev || (next.size === 0 && prev.size === 0)) return;
    const map = next instanceof Map ? next : new Map(next);
    runtimeErrorsRef.current = map;
    setRuntimeErrors(map);
  }, []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  // Момент последнего непустого UPDATE-кадра — обрыв Kafka-консьюмера на бэкенде
  // не рвёт WS, поэтому статус может оставаться "live" при замерших значениях;
  // единственный признак — переставший расти ts/момент приёма кадра.
  const lastMessageAtRef = useRef(0);
  // Живое зеркало status для интервала проверки устаревания (эффект соединения
  // создаётся один раз на (active, projectId), status в его замыкании был бы старым).
  const statusRef = useRef<RuntimeStatus>(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Компиляция один раз на identity elements (загрузка/пересохранение сцены).
  const index = useMemo(
    () => (active ? buildBindingIndex(elements) : null),
    [active, elements],
  );
  const indexRef = useRef(index);
  // Синхронно при рендере, как было всегда: тик flush и обработчики, сработавшие до эффектов
  // этого рендера, должны уже видеть индекс нового документа. Перенос в эффект сдвинул бы это.
  // eslint-disable-next-line react-hooks/refs
  indexRef.current = index;

  // Все теги открытой схемы: их просит у архива воспроизведение, на них же подписывается
  // живой WS. Перья трендов входят через elementKeysByTagId — это тег-свойства.
  const sceneTags = useMemo(() => {
    if (!index) return [] as string[];
    const all = new Set<string>(index.tagIds);
    for (const map of [index.elementKeysByTagId, index.tableCellsByTagId, index.directTagsByTagId]) {
      for (const tag of map.keys()) all.add(tag);
    }
    return [...all].sort();
  }, [index]);
  const sceneId = useOpenScene(s => (s.scene?.id == null ? null : Number(s.scene.id)));
  const extraTags = useRuntimeTagInterest();

  // Буферы сессии значений — см. EngineBuffers. Объект один на всё время жизни движка.
  const [buffers] = useState(newEngineBuffers);
  // Активное WS-соединение — чтобы обработчик клика (runScript) мог послать ACTION.
  const connRef = useRef<RuntimeConnection | null>(null);
  /** Где оператор нажал скрипт (по серверному id) — туда же ляжет отказ ACTION_DENIED. */
  const actionPointsRef = useRef(new Map<number, ScreenPoint | undefined>());

  const flush = useCallback(() => {
    flushEngine(buffers, indexRef.current, runtimeErrorsRef.current, publishRuntimeErrors);
  }, [publishRuntimeErrors, buffers]);

  const flushRef = useRef(flush);
  // То же, что у indexRef: ссылка обновляется при рендере, а не эффектом.
  // eslint-disable-next-line react-hooks/refs
  flushRef.current = flush;

  // Последняя подписка на сцену, о которой знает runtime; null — подписки нет, сервер шлёт
  // теги всего проекта (до первой подписки и после TREE_CHANGED).
  // `tags` — полный набор (схема + панели) для локального сравнения и сброса, `wire` — то, что
  // ушло в сокет.
  const lastSubRef = useRef<SceneSubscription | null>(null);

  // Подписка WS на открытую сцену. Объявлена РАНЬШЕ повторного прогона при смене схемы:
  // сброс значений обязан случиться до того, как прогон прочитает значения и посчитает «нет данных».
  useSceneSubscription({active, mode, sceneId, sceneTags, extraTags, buffers, connRef, lastSubRef});

  /**
   * Открытие схемы: сид значений + ПОВТОРНЫЙ ПРОГОН биндингов по уже известным значениям.
   *
   * Индекс пересобирается на смену identity `elements`, то есть ровно тогда, когда на
   * холст лёг другой документ — это единственная надёжная точка «схема сменилась».
   * Соединение при этом не пересоздаётся (оно живёт на пару active+projectId), поэтому
   * значения тегов всей сессии остаются на руках, и открытая схема обязана нарисоваться
   * по ним сразу, а не ждать, пока значение изменится.
   *
   * Порядок внутри строгий: сначала сид значений свойств, потом прогон — иначе биндинги
   * прочитают свойства как null.
   */
  useEffect(() => {
    if (!active) return;
    const idx = indexRef.current;
    if (!idx) return;
    reseedScene(buffers, idx, publishRuntimeErrors);
    // publishRuntimeErrors стабилен (useCallback без зависимостей) — в списке он ради
    // правила exhaustive-deps, пересчёт схемы им не запускается.
  }, [active, index, publishRuntimeErrors, buffers]);

  // Действия и шина: после повторного прогона при смене схемы, до эффекта соединения.
  useRuntimeActions({active, mode, status, buffers, connRef, actionPointsRef, flushRef});

  /**
   * История трендов за самое широкое окно, кончающееся в `at` (сейчас или курсор архива).
   * Прошлый запрос обрывается: при перемотке его ответ лёг бы поверх нового ряда.
   */
  const trendHistoryAbortRef = useRef<AbortController | null>(null);
  const loadTrendHistory = useCallback((at: number): AbortController => {
    trendHistoryAbortRef.current?.abort();
    const controller = new AbortController();
    trendHistoryAbortRef.current = controller;
    const {watched, retentionMs} = useTrendStore.getState();
    // Проект — из стора, а не из замыкания: колбэк общий для эффектов и не должен пересоздаваться.
    const projectId = getOpenScene().currentProject?.id;
    if (projectId == null) return controller;
    fetchArchiveValues([...watched], at - retentionMs, at, {projectId, signal: controller.signal})
      .then(series => {
        if (!controller.signal.aborted) mergeTrendHistory(series, at);
      })
      .catch(e => {
        if (controller.signal.aborted) return;
        // Без истории тренд всё равно дописывается точками — не повод для тоста.
        console.warn("[monitor:trend] история не загружена:", e);
      });
    return controller;
  }, []);

  /**
   * Всё, что принадлежит сессии значений (WS или воспроизведения архива): буферы, качество,
   * счётчики ошибок, рантайм-карты стора и серии трендов. Общий сброс для выхода из обоих
   * режимов — чтобы в архив не протекли живые значения, а из архива в живой режим прошлое.
   */
  const resetSessionState = useCallback(() => {
    resetSessionBuffers(buffers);
    getSceneView().clearRuntime();
    resetTrendStore();
  }, [buffers]);

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
       * запись оператором: значения в pendingRef, затем синхронный flush. Предзаписывать
       * valuesRef НЕЛЬЗЯ — no-op-страж во flush счёл бы изменение отсутствующим, и ни
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

        // События процедуры НЕ кладём в pendingRef: тот буфер коалесцирует значения
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
  }, [active, projectId, mode, resetSessionState, buffers]);

  /**
   * Режим «Архив»: WS не подключается, значения подаёт плеер через `archive.apply`. Здесь —
   * только вход и выход: статус «нет соединения» (закрытое соединение его не всегда
   * присылает) и сброс всего проигранного при выходе.
   */
  useEffect(() => {
    if (!active || mode !== "archive") return;
    log("режим архива: живое соединение не открывается");
    setStatus("closed");
    setStatusDetail(null);
    return () => {
      trendHistoryAbortRef.current?.abort();
      resetSessionState();
    };
  }, [active, mode, resetSessionState]);

  /**
   * Тренды открытой схемы: набор тегов перьев и история за самое широкое окно.
   *
   * На смену `index` — как и повторный прогон биндингов: это единственная надёжная точка
   * «на холст лёг другой документ». Дальше тренды дописываются из кадров WS
   * (pushTrendPoints). История грузится одним запросом по всем перьям (пачки по 20 тегов
   * режет fetchArchiveValues); смена схемы обрывает запрос прошлой.
   */
  //
  // В архиве здесь только набор перьев: историю грузит `archive.reset` на момент курсора,
  // потому что после каждой перемотки она нужна заново.
  useEffect(() => {
    if (!active || !index) return;
    const tags = new Set<string>();
    let windowSec = 0;
    for (const el of getSceneView().elements) {
      if (el.type !== "trend") continue;
      const pens = trendPens(el);
      if (!pens.length) continue;
      for (const pen of pens) tags.add(pen.tag);
      windowSec = Math.max(windowSec, trendTiming(el.trend).window);
    }
    setTrendWatch(tags, windowSec * 1000);
    if (mode !== "live" || !tags.size) return;
    const controller = loadTrendHistory(Date.now());
    return () => controller.abort();
  }, [active, index, mode, loadTrendHistory]);

  // Дискретные теги схемы по типу свойства — на случай, если по WS тег в этой вкладке ещё
  // не приходил и его вид неизвестен.
  const boolPropertyTagsRef = useRef(new Set<string>());
  useEffect(() => {
    const set = new Set<string>();
    for (const el of elements) {
      for (const p of el.properties ?? []) {
        if (p.property_type === "Тег" && p.tag_id && isBooleanValueType(p.value_type ?? undefined)) set.add(p.tag_id);
      }
    }
    boolPropertyTagsRef.current = set;
  }, [elements]);

  const isBoolTag = useCallback(
    (tag: string) => wireBoolTags.has(tag) || boolPropertyTagsRef.current.has(tag),
    [],
  );

  const archiveReset = useCallback((at: number) => {
    resetArchiveBuffers(buffers);
    getSceneView().clearRuntime();

    clearTrendSeries();
    setTrendClock(at);
    if (useTrendStore.getState().watched.size) loadTrendHistory(at);
  }, [loadTrendHistory, buffers]);

  /**
   * Изменения из архива — тем же путём, что кадр WS: значения в pendingRef, качество в
   * tagMetaRef, точки трендов мимо flush, затем синхронный flush. Суточная опорная точка с тем
   * же значением отсекается no-op-стражем flush и ничего не перерисовывает.
   */
  const archiveApply = useCallback((changes: readonly ArchiveTagChange[]) => {
    const frames = changes.map(c => ({
      tagId: c.tag, value: c.value, ts: c.ts, quality: c.good ? "GOOD" : "BAD",
    }));
    ingestTags(buffers, frames);
    pushTrendPoints(frames);
    flushRef.current();
  }, [buffers]);

  const archive = useMemo<RuntimeArchiveInput>(
    () => ({reset: archiveReset, apply: archiveApply, sceneTags, isBoolTag, projectId}),
    [archiveReset, archiveApply, sceneTags, isBoolTag, projectId],
  );

  const subscribeTasks = useCallback(() => connRef.current?.subscribeTasks(), []);
  const unsubscribeTasks = useCallback(() => connRef.current?.unsubscribeTasks(), []);

  return {
    status,
    compileErrors: index?.compileErrors ?? new Map(),
    runtimeErrors,
    sessionId,
    statusDetail,
    isStale,
    subscribeTasks,
    unsubscribeTasks,
    archive,
  };
}
