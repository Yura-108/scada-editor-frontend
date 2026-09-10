"use client";

import {useCallback, useState} from "react";
import {toast} from "sonner";
import {useProcedureStore} from "@/store/useProcedureStore";
import {getRuntimeSessionId} from "@/lib/runtime/runtimeEventBus";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {
  abortProcedure,
  confirmStep,
  jumpToStep,
  startProcedure,
} from "@/lib/runtime/procedures";

/**
 * Действия над процедурой: запустить, подтвердить шаг, перейти на шаг, прервать.
 *
 * ТОЛЬКО колбэки, без эффектов — поэтому хук безопасно вызывать из скольких угодно мест
 * (панель «Процедуры» и HUD над схемой делают это одновременно). Всё, что должно случаться
 * само по себе — опрос состояния, подсказка восстановления, тосты по алертам, — вынесено
 * в `useProcedureSync`, и тот монтируется ровно один раз.
 */
export function useProcedureControls() {
  const [busy, setBusy] = useState(false);

  /**
   * Сессию берём геттером, а не из состояния движка: копия в `useRuntimeEngine.sessionId`
   * обновляется только на переходах статуса, а геттер всегда актуален.
   */
  const withSession = useCallback(async (
    fallback: string,
    fn: (sessionId: string) => Promise<void>,
  ) => {
    const sessionId = getRuntimeSessionId();
    if (!sessionId) {
      toast.error("Нет активной сессии мониторинга");
      return;
    }
    setBusy(true);
    try {
      await fn(sessionId);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback((recipeId: string) =>
    withSession("Не удалось запустить процедуру", async (sessionId) => {
      useProcedureStore.getState().setStatus(await startProcedure(recipeId, sessionId));
    }), [withSession]);

  const confirm = useCallback((recipeId: string) =>
    withSession("Не удалось подтвердить шаг", async (sessionId) => {
      useProcedureStore.getState().setStatus(await confirmStep(recipeId, sessionId));
    }), [withSession]);

  const jump = useCallback((recipeId: string, stepIndex: number) =>
    withSession("Не удалось перейти на шаг", async (sessionId) => {
      useProcedureStore.getState().setStatus(await jumpToStep(recipeId, sessionId, stepIndex));
    }), [withSession]);

  /** Прерывание необратимо для текущего шага, поэтому спрашиваем подтверждение. */
  const abort = useCallback((recipeId: string) =>
    withSession("Не удалось прервать процедуру", async (sessionId) => {
      const ok = await confirmModal({
        title: "Прервать процедуру?",
        description: "Текущий шаг останется незавершённым, записанные значения в ПЛК не откатываются.",
        confirmLabel: "Прервать",
        danger: true,
      });
      if (!ok) return;
      await abortProcedure(recipeId, sessionId);
      // Наблюдение за тем же рецептом продолжаем, но с чистого листа.
      useProcedureStore.getState().watch(recipeId);
    }), [withSession]);

  return {busy, start, confirm, jump, abort};
}
