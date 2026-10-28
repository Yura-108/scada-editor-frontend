"use client";

import {create} from "zustand";

/**
 * Состояние плеера архива (режим «Архив» монитора). Только то, что показывает панель;
 * буфер ленты и таймер живут в useArchiveReplay — они не для рендера.
 */
export const REPLAY_SPEEDS = [1, 2, 5, 10, 60, 600] as const;

export interface ArchiveReplayState {
  /** Проигрываемый период, мс. */
  from: number;
  to: number;
  /** Момент, который сейчас показывает схема. */
  cursor: number;
  playing: boolean;
  speed: number;
  /** Идёт запрос первой страницы (перемотка / старт) — схема ещё старая. */
  loading: boolean;
  /** Курсор упёрся в ещё не загруженную страницу. */
  buffering: boolean;
  /** Дошли до конца периода. */
  ended: boolean;
  error: string | null;
}

const HOUR = 3600_000;

export const initialReplayState = (now = Date.now()): ArchiveReplayState => ({
  from: now - HOUR,
  to: now,
  cursor: now - HOUR,
  playing: false,
  speed: 10,
  loading: false,
  buffering: false,
  ended: false,
  error: null,
});

export const useArchiveReplayStore = create<ArchiveReplayState>(() => initialReplayState());
