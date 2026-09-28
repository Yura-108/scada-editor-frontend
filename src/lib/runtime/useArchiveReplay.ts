"use client";

import {useCallback, useEffect, useRef} from "react";
import {archiveValueToWire, fetchReplayPage, ARCHIVE_DEPTH_MS, type ReplayChange} from "@/lib/runtime/archive";
import {
  advanceCursor, appendPage, canSeekInBuffer, emptyBuffer, needsPrefetch, takeUntil, type ReplayBuffer,
} from "@/lib/runtime/replayBuffer";
import type {ArchiveTagChange, RuntimeArchiveInput} from "@/lib/runtime/useRuntimeEngine";
import {setTrendClock} from "@/store/useTrendStore";
import {initialReplayState, useArchiveReplayStore} from "@/store/useArchiveReplayStore";
import {devLog} from "@/lib/devLog";

/** Тик плеера. interval, а не rAF: в фоновой вкладке rAF замерзает. */
const TICK_MS = 200;
/** Самый длинный шаг тика в реальном времени: вкладка вернулась из фона — не прыгать на часы. */
const MAX_TICK_REAL_MS = 2000;

const log = (...args: unknown[]) => devLog("[monitor:archive]", ...args);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface ArchiveReplayControls {
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (ts: number) => void;
  setPeriod: (from: number, to: number) => void;
}

/**
 * Плеер режима «Архив» (контракт 2026-09-28-tag-archive-contract.md, раздел 4).
 *
 * Берёт ленту `POST /archive/replay` страницами и подаёт её в движок монитора
 * (`archive.apply`) — тем же путём, что кадры WS, поэтому биндинги рисуют схему как обычно.
 * Скорость и пауза — здесь, на фронте. Перемотка вперёд внутри загруженного просто
 * применяет ленту до новой точки; назад или дальше загруженного — новый запрос с `from` =
 * точке перемотки (так велит контракт: `initial` бывает только у первой страницы).
 *
 * Монтируется ровно один раз — в MonitorClient: два плеера на одну схему применяли бы ленту
 * дважды.
 */
export function useArchiveReplay(archive: RuntimeArchiveInput, enabled: boolean): ArchiveReplayControls {
  // Последний вход движка для колбэков. Эффект объявлен первым — к запуску ленты ниже в том
  // же коммите ref уже свежий.
  const archiveRef = useRef(archive);
  useEffect(() => { archiveRef.current = archive; }, [archive]);

  const bufferRef = useRef<ReplayBuffer>(emptyBuffer(0));
  /** `from` запроса, к которому относятся страницы буфера (для `after` нужен тот же запрос). */
  const requestFromRef = useRef(0);
  const startCtrlRef = useRef<AbortController | null>(null);
  const pageCtrlRef = useRef<AbortController | null>(null);
  const lastTickAtRef = useRef(0);

  const toWire = useCallback((c: ReplayChange): ArchiveTagChange => ({
    tag: c.tag,
    ts: c.ts,
    good: c.good,
    value: archiveValueToWire(c.value, c.good, archiveRef.current.isBoolTag(c.tag)),
  }), []);

  const abortAll = useCallback(() => {
    startCtrlRef.current?.abort();
    startCtrlRef.current = null;
    pageCtrlRef.current?.abort();
    pageCtrlRef.current = null;
  }, []);

  /** Начать ленту с момента `at`: первая страница, состояние на `at`, курсор на `at`. */
  const start = useCallback((rawAt: number) => {
    abortAll();
    const {to} = useArchiveReplayStore.getState();
    // `from < to` — требование бэкенда; перемотка в самый конец встаёт за секунду до него.
    const at = Math.min(Math.max(rawAt, Date.now() - ARCHIVE_DEPTH_MS), to - 1000);
    const tags = archiveRef.current.sceneTags;
    const set = useArchiveReplayStore.setState;
    set({loading: true, buffering: false, ended: false, error: null});

    if (!tags.length) {
      // На схеме нет тегов — проигрывать нечего, но курсор и тренды должны встать на место.
      archiveRef.current.reset(at);
      archiveRef.current.apply([]);
      bufferRef.current = emptyBuffer(to);
      set({cursor: at, loading: false});
      return;
    }

    const ctrl = new AbortController();
    startCtrlRef.current = ctrl;
    log(`лента с ${new Date(at).toISOString()}, тегов ${tags.length}`);
    fetchReplayPage({tags, from: at, to, after: null, signal: ctrl.signal})
      .then(page => {
        if (ctrl.signal.aborted) return;
        startCtrlRef.current = null;
        // Сброс — только когда ответ уже на руках: иначе на время запроса схема опустела бы.
        archiveRef.current.reset(at);
        const initial: ArchiveTagChange[] = [];
        for (const v of page.initial?.values() ?? []) if (v) initial.push(toWire(v));
        archiveRef.current.apply(initial);
        requestFromRef.current = at;
        bufferRef.current = {changes: page.changes, applied: 0, next: page.next, periodTo: to};
        lastTickAtRef.current = Date.now();
        set({cursor: at, loading: false});
        log(`страница 1: изменений ${page.changes.length}, дальше ${page.next ? "есть" : "нет"}`);
      })
      .catch(e => {
        if (ctrl.signal.aborted) return;
        startCtrlRef.current = null;
        set({loading: false, playing: false, error: errorText(e)});
      });
  }, [abortAll, toWire]);

  /** Следующая страница того же запроса — пока играет текущая. */
  const prefetch = useCallback(() => {
    const b = bufferRef.current;
    if (pageCtrlRef.current || startCtrlRef.current || b.next === null) return;
    const tags = archiveRef.current.sceneTags;
    const ctrl = new AbortController();
    pageCtrlRef.current = ctrl;
    fetchReplayPage({tags, from: requestFromRef.current, to: b.periodTo, after: b.next, signal: ctrl.signal})
      .then(page => {
        if (ctrl.signal.aborted) return;
        pageCtrlRef.current = null;
        bufferRef.current = appendPage(bufferRef.current, page.changes, page.next);
        log(`следующая страница: изменений ${page.changes.length}, дальше ${page.next ? "есть" : "нет"}`);
      })
      .catch(e => {
        if (ctrl.signal.aborted) return;
        pageCtrlRef.current = null;
        useArchiveReplayStore.setState({playing: false, buffering: false, error: errorText(e)});
      });
  }, []);

  /** Применить ленту до `until` и поставить туда курсор. */
  const applyUntil = useCallback((until: number) => {
    const b = bufferRef.current;
    const {batch, applied} = takeUntil(b, until);
    bufferRef.current = {...b, applied};
    if (batch.length) archiveRef.current.apply(batch.map(toWire));
    setTrendClock(until);
  }, [toWire]);

  const tick = useCallback(() => {
    const st = useArchiveReplayStore.getState();
    if (!st.playing || st.loading) return;
    const now = Date.now();
    const realStep = Math.min(MAX_TICK_REAL_MS, Math.max(0, now - (lastTickAtRef.current || now)));
    lastTickAtRef.current = now;

    const {cursor, buffering} = advanceCursor(bufferRef.current, st.cursor, realStep * st.speed);
    applyUntil(cursor);

    const b = bufferRef.current;
    const ended = cursor >= st.to && b.next === null && b.applied >= b.changes.length;
    useArchiveReplayStore.setState({cursor, buffering, ended, playing: !ended});
    if (needsPrefetch(b)) prefetch();
  }, [applyUntil, prefetch]);

  // Вход в архив: период по умолчанию — последний час, стоим на его начале. Смена схемы
  // (другой набор тегов) — перезапрос с текущего курсора: у новой схемы свои теги, а
  // `initial` бывает только у первой страницы.
  const tagsKey = archive.sceneTags.join("\n");
  const startedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (!startedRef.current) {
      startedRef.current = true;
      const init = initialReplayState();
      useArchiveReplayStore.setState(init);
      start(init.from);
    } else {
      start(useArchiveReplayStore.getState().cursor);
    }
  }, [enabled, tagsKey, start]);

  useEffect(() => {
    if (enabled) return;
    startedRef.current = false;
    abortAll();
    bufferRef.current = emptyBuffer(0);
    useArchiveReplayStore.setState({playing: false, loading: false, buffering: false});
  }, [enabled, abortAll]);

  useEffect(() => () => abortAll(), [abortAll]);

  const playing = useArchiveReplayStore(s => s.playing);
  useEffect(() => {
    if (!enabled || !playing) return;
    lastTickAtRef.current = Date.now();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, playing, tick]);

  const play = useCallback(() => {
    const st = useArchiveReplayStore.getState();
    // Доиграли — «играть» начинает период заново.
    if (st.ended || st.cursor >= st.to) {
      useArchiveReplayStore.setState({playing: true, ended: false});
      start(st.from);
      return;
    }
    useArchiveReplayStore.setState({playing: true});
  }, [start]);

  const pause = useCallback(() => useArchiveReplayStore.setState({playing: false}), []);

  const setSpeed = useCallback((speed: number) => useArchiveReplayStore.setState({speed}), []);

  const seek = useCallback((raw: number) => {
    const st = useArchiveReplayStore.getState();
    const ts = Math.min(Math.max(raw, st.from), st.to);
    if (!st.loading && canSeekInBuffer(bufferRef.current, st.cursor, ts)) {
      applyUntil(ts);
      useArchiveReplayStore.setState({cursor: ts, ended: false});
      if (needsPrefetch(bufferRef.current)) prefetch();
      return;
    }
    useArchiveReplayStore.setState({cursor: ts});
    start(ts);
  }, [applyUntil, prefetch, start]);

  const setPeriod = useCallback((from: number, to: number) => {
    const oldest = Date.now() - ARCHIVE_DEPTH_MS;
    const f = Math.max(from, oldest);
    const t = Math.min(to, Date.now());
    if (!(f < t)) {
      useArchiveReplayStore.setState({error: "Начало периода должно быть раньше конца, не старше 30 дней"});
      return;
    }
    useArchiveReplayStore.setState({from: f, to: t, cursor: f, playing: false, ended: false});
    start(f);
  }, [start]);

  return {play, pause, setSpeed, seek, setPeriod};
}
