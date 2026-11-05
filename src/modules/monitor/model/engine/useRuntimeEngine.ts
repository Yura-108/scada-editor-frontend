"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {getSceneView, useSceneView} from "@/core/scene";
import {buildBindingIndex} from "./bindingIndex";
import {flushEngine} from "./flushEngine";
import {reseedScene} from "./sceneReseed";
import {useSceneSubscription, type SceneSubscription} from "./useSceneSubscription";
import {useRuntimeActions} from "./useRuntimeActions";
import {useLiveConnection} from "./useLiveConnection";
import {useArchiveInput, useArchiveMode, type RuntimeArchiveInput} from "./useArchiveInput";
import {useTrendHistoryLoader, useTrendWatch} from "./useTrendHistory";
import {newEngineBuffers, resetSessionBuffers} from "./engineBuffers";
import {createScriptSandbox, type ScreenPoint, type ScriptSandbox} from "@/core/runtime";
import type {RuntimeConnection, RuntimeStatus} from "./runtimeConnection";
import {useRuntimeTagInterest} from "./runtimeTagInterest";
import {resetTrendStore} from "@/core/canvas";
import {useOpenScene} from "@/core/project";

export type {ArchiveTagChange, RuntimeArchiveInput} from "./useArchiveInput";

const NO_ERRORS = new Map<string, string>();

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
  // Ошибки компиляции приходят ответом песочницы на загрузку схемы (reseedScene).
  const [compileErrors, setCompileErrors] = useState<Map<string, string>>(new Map());
  const publishCompileErrors = useCallback((next: ReadonlyMap<string, string>) => {
    setCompileErrors(prev => (prev.size === 0 && next.size === 0 ? prev : new Map(next)));
  }, []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
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

  // Песочница скриптов схемы (#20 п. 1): одна на движок — обработчики кликов и привязки, в
  // живом режиме и в архиве. Поднимаем сразу, чтобы первый клик не ждал запуска воркера.
  const sandboxRef = useRef<ScriptSandbox | null>(null);
  useEffect(() => {
    if (!active) return;
    const sandbox = createScriptSandbox();
    sandboxRef.current = sandbox;
    return () => {
      sandboxRef.current = null;
      sandbox.dispose();
    };
  }, [active]);

  const flush = useCallback(() => {
    flushEngine(buffers, indexRef.current, sandboxRef.current, () => runtimeErrorsRef.current, publishRuntimeErrors);
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
    reseedScene(buffers, idx, sandboxRef.current, publishRuntimeErrors, publishCompileErrors);
    // publish* стабильны (useCallback без зависимостей) — в списке они ради
    // правила exhaustive-deps, пересчёт схемы ими не запускается.
  }, [active, index, publishRuntimeErrors, publishCompileErrors, buffers]);

  // Действия и шина: после повторного прогона при смене схемы, до эффекта соединения.
  useRuntimeActions({active, mode, status, buffers, connRef, actionPointsRef, flushRef, sandboxRef});

  const {loadTrendHistory, trendHistoryAbortRef} = useTrendHistoryLoader();

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

  // Соединение, затем вход в архив, затем тренды и вход плеера — в прежнем порядке эффектов.
  useLiveConnection({
    active, projectId, mode, buffers, connRef, lastSubRef, actionPointsRef, flushRef, statusRef,
    resetSessionState, setStatus, setStatusDetail, setSessionId, setIsStale,
  });
  useArchiveMode({active, mode, setStatus, setStatusDetail, trendHistoryAbortRef, resetSessionState});
  useTrendWatch({active, index, mode, loadTrendHistory});
  const archive = useArchiveInput({elements, buffers, flushRef, loadTrendHistory, sceneTags, projectId});


  const subscribeTasks = useCallback(() => connRef.current?.subscribeTasks(), []);
  const unsubscribeTasks = useCallback(() => connRef.current?.unsubscribeTasks(), []);

  return {
    status,
    compileErrors: index ? compileErrors : NO_ERRORS,
    runtimeErrors,
    sessionId,
    statusDetail,
    isStale,
    subscribeTasks,
    unsubscribeTasks,
    archive,
  };
}
