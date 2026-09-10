"use client";

import {useEffect} from "react";
import {toast} from "sonner";
import {useProcedureStore} from "@/store/useProcedureStore";
import {getRuntimeSessionId} from "@/lib/runtime/runtimeEventBus";
import {
  fetchProcedureStatus,
  fetchResumeGuess,
  NoActiveProcedureError,
} from "@/lib/runtime/procedures";

/**
 * Фоновая часть процедуры: сверка состояния и уведомления об отказах.
 *
 * **Монтируется ровно один раз** — в `MonitorClient`. Состояние процедуры показывают двое
 * (панель «Процедуры» и HUD над схемой), и повтори каждый из них эти эффекты, вышло бы два
 * опроса `GET /status`, два запроса подсказки и по два тоста на каждое событие.
 */

/**
 * Сверка со `/status`. Редкая намеренно: ход процедуры приезжает событиями по WS, а
 * секундомер тикает на клиенте — сеть нужна лишь чтобы поймать пропущенный кадр.
 */
const STATUS_POLL_MS = 5000;

export function useProcedureSync(): void {
  const recipeId = useProcedureStore(s => s.recipeId);
  const lastAlert = useProcedureStore(s => s.lastAlert);

  /**
   * Отказ записи внутри шага виден ТОЛЬКО этим каналом: запись из `action` идёт
   * fire-and-forget, и без события оператор не узнал бы о ней ничего.
   */
  useEffect(() => {
    if (!lastAlert) return;
    const text = lastAlert.message
      ?? (lastAlert.kind === "STALLED" ? "Шаг долго не завершается" : "Отказ записи");
    if (lastAlert.kind === "WRITE_FAILED") toast.error(`Запись не прошла: ${text}`);
    else toast.warning(text);
    useProcedureStore.getState().clearAlert();
  }, [lastAlert]);

  useEffect(() => {
    if (!recipeId) return;

    let cancelled = false;

    const sync = async () => {
      const sessionId = getRuntimeSessionId();
      if (!sessionId) return;
      try {
        const next = await fetchProcedureStatus(recipeId, sessionId);
        if (!cancelled) useProcedureStore.getState().setStatus(next);
      } catch (err) {
        if (cancelled || !(err instanceof NoActiveProcedureError)) return;
        // Рантайм перезапустили — процедуры в его памяти нет. Просим подсказку, но НЕ
        // прыгаем сами: она ошибается на шагах с условием по времени или подтверждению.
        try {
          const guess = await fetchResumeGuess(recipeId, sessionId);
          if (!cancelled) useProcedureStore.getState().setResumeHint(guess.suggestedStepIndex);
        } catch {
          // Подсказка необязательна: без неё оператор выберет шаг сам.
        }
      }
    };

    void sync();
    const id = setInterval(() => void sync(), STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [recipeId]);
}
