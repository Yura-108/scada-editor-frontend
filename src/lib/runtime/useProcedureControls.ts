"use client";

import {useCallback, useMemo, useState} from "react";
import {toast} from "sonner";
import {useProcedureStore} from "@/store/useProcedureStore";
import {useEditorStore} from "@/store/useEditorStore";
import {getRuntimeSessionId} from "@/lib/runtime/runtimeEventBus";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {
  abortProcedure,
  confirmStep,
  jumpToStep,
  pauseProcedure,
  ProcedureConflictError,
  resumeProcedure,
  startProcedure,
} from "@/lib/runtime/procedures";
import {useProcedureLevelsStore} from "@/store/useProcedureLevelsStore";
import {useCurrentProjectGrant} from "@/lib/access/projectAccess";
import {actionDenialText} from "@/lib/runtime/actionAccess";
import {PROCEDURE_OPERATIONS, type ProcedureOperation} from "@/types/access.types";

/**
 * Действия над процедурой: запустить, подтвердить шаг, перейти на шаг, прервать.
 *
 * ТОЛЬКО колбэки, без эффектов — поэтому хук безопасно вызывать из скольких угодно мест
 * (панель «Процедуры» и HUD над схемой делают это одновременно). Всё, что должно случаться
 * само по себе — сверка состояния и тосты по алертам, — вынесено в `useProcedureSync`,
 * и тот монтируется ровно один раз.
 */
export function useProcedureControls() {
  const [busy, setBusy] = useState(false);
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const grant = useCurrentProjectGrant();
  const levels = useProcedureLevelsStore(s => s.levels);

  /**
   * Почему операция недоступна (null — доступна): нет «управления» или уровень ниже
   * уровня операции из prod-выпуска. Кнопки гаснут с этой подписью; сервер проверяет то же
   * и при расхождении ответит 403 с нужным уровнем.
   */
  const denied = useMemo(() => {
    const out = {} as Record<ProcedureOperation, string | null>;
    for (const op of PROCEDURE_OPERATIONS) out[op] = actionDenialText(grant, levels[op]);
    return out;
  }, [grant, levels]);

  /**
   * Ключ процедуры — проект: мойка идёт и без открытого монитора, поэтому сессия для
   * действия не нужна. `sessionId` добавляем подписью, если сессия есть; её отсутствие
   * действию не мешает.
   */
  const withProject = useCallback(async (
    fallback: string,
    fn: (projectId: number, sessionId?: string) => Promise<void>,
  ) => {
    if (projectId == null) {
      toast.error("Проект не выбран");
      return;
    }
    setBusy(true);
    try {
      await fn(projectId, getRuntimeSessionId() ?? undefined);
    } catch (err) {
      console.error(err);
      if (err instanceof ProcedureConflictError) {
        // Не ошибка, а состояние: мойка уже идёт либо проект не в эксплуатации. Если бэкенд
        // прислал текущий статус — показываем его, чтобы оператор увидел, на каком она шаге.
        if (err.procedure) useProcedureStore.getState().setStatus(err.procedure);
        toast.warning(err.message);
        return;
      }
      toast.error(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  const start = useCallback((recipeId: string) =>
    withProject("Не удалось запустить процедуру", async (project, session) => {
      useProcedureStore.getState().setStatus(await startProcedure(recipeId, project, session));
    }), [withProject]);

  const confirm = useCallback((recipeId: string) =>
    withProject("Не удалось подтвердить шаг", async (project, session) => {
      useProcedureStore.getState().setStatus(await confirmStep(recipeId, project, session));
    }), [withProject]);

  const pause = useCallback((recipeId: string) =>
    withProject("Не удалось поставить процедуру на паузу", async (project, session) => {
      useProcedureStore.getState().setStatus(await pauseProcedure(recipeId, project, session));
    }), [withProject]);

  /**
   * Отказ при активной аварии приходит как 409 и разбирается общим обработчиком: оператор
   * увидит текст аварии предупреждением, а не красной ошибкой, — продолжить сейчас нельзя,
   * но и сломалось ничего.
   */
  const resume = useCallback((recipeId: string) =>
    withProject("Не удалось продолжить процедуру", async (project, session) => {
      useProcedureStore.getState().setStatus(await resumeProcedure(recipeId, project, session));
    }), [withProject]);

  const jump = useCallback((recipeId: string, stepIndex: number) =>
    withProject("Не удалось перейти на шаг", async (project, session) => {
      useProcedureStore.getState().setStatus(
        await jumpToStep(recipeId, project, stepIndex, session),
      );
    }), [withProject]);

  /** Прерывание необратимо для текущего шага, поэтому спрашиваем подтверждение. */
  const abort = useCallback((recipeId: string) =>
    withProject("Не удалось прервать процедуру", async (project, session) => {
      const ok = await confirmModal({
        title: "Прервать процедуру?",
        description: "Текущий шаг останется незавершённым, записанные значения в ПЛК не откатываются.",
        confirmLabel: "Прервать",
        danger: true,
      });
      if (!ok) return;
      await abortProcedure(recipeId, project, session);
      // Наблюдение за тем же рецептом продолжаем, но с чистого листа.
      useProcedureStore.getState().watch(recipeId);
    }), [withProject]);

  return {busy, denied, start, confirm, pause, resume, jump, abort};
}
