"use client";

import React, {useEffect, useState} from "react";
import {AlertTriangle, CheckCircle2, ChevronRight, CircleStop, Play, TimerReset} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useRecipeStore} from "@/store/useRecipeStore";
import {useProcedureStore} from "@/store/useProcedureStore";
import {getRuntimeSessionId} from "@/lib/runtime/runtimeEventBus";
import {
  abortProcedure,
  confirmStep,
  fetchProcedureStatus,
  fetchResumeGuess,
  jumpToStep,
  NoActiveProcedureError,
  startProcedure,
} from "@/lib/runtime/procedures";

/**
 * Выполнение процедурного рецепта в мониторе.
 *
 * Панель, а не модалка: процедура идёт минутами, и оператор всё это время должен видеть
 * мнемосхему — модалка её закрывает.
 */

/** Сверка со `/status`. Редкая: ход процедуры приходит событиями по WS, а секундомер
 *  тикает на клиенте — сеть нужна только чтобы поймать пропущенный кадр. */
const STATUS_POLL_MS = 5000;

/** Отдельный тик для секундомера — он рисуется, а не запрашивается. */
const CLOCK_TICK_MS = 500;

const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

export function ProcedurePanel() {
  const {recipes, loaded, isLoading, loadRecipes} = useRecipeStore();
  const {recipeId, status, stepStartedAt, lastAlert, watch, setStatus, clearAlert} = useProcedureStore();

  const [busy, setBusy] = useState(false);
  const [resumeHint, setResumeHint] = useState<number | null>(null);
  // Тик перерисовки: секундомер шага считается от stepStartedAt, а не хранится в стейте.
  const [, setTick] = useState(0);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;
  const steps = recipe?.steps ?? [];

  useEffect(() => {
    if (!loaded) void loadRecipes();
  }, [loaded, loadRecipes]);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Отказ записи внутри шага виден только этим каналом (запись идёт fire-and-forget),
  // поэтому показываем его отдельно и заметно.
  useEffect(() => {
    if (!lastAlert) return;
    const text = lastAlert.message ?? (lastAlert.kind === "STALLED" ? "Шаг долго не завершается" : "Отказ записи");
    if (lastAlert.kind === "WRITE_FAILED") toast.error(`Запись не прошла: ${text}`);
    else toast.warning(text);
    clearAlert();
  }, [lastAlert, clearAlert]);

  /** Сверка состояния; 400 значит «процедуры нет в памяти» — предлагаем восстановление. */
  useEffect(() => {
    if (!recipeId) return;

    let cancelled = false;
    const sync = async () => {
      const sessionId = getRuntimeSessionId();
      if (!sessionId) return;
      try {
        const next = await fetchProcedureStatus(recipeId, sessionId);
        if (!cancelled) {
          setStatus(next);
          setResumeHint(null);
        }
      } catch (err) {
        if (cancelled || !(err instanceof NoActiveProcedureError)) return;
        // Рантайм перезапустили — состояние в памяти потеряно. Просим подсказку,
        // но не прыгаем сами: она ошибается на шагах с условием по времени/подтверждению.
        try {
          const guess = await fetchResumeGuess(recipeId, sessionId);
          if (!cancelled) setResumeHint(guess.suggestedStepIndex);
        } catch { /* подсказка необязательна */ }
      }
    };

    void sync();
    const id = setInterval(() => void sync(), STATUS_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [recipeId, setStatus]);

  const withSession = async (what: string, fn: (sessionId: string) => Promise<void>) => {
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
      toast.error(err instanceof Error ? err.message : what);
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => recipeId && withSession("Не удалось запустить процедуру", async (sessionId) => {
    setStatus(await startProcedure(recipeId, sessionId));
    setResumeHint(null);
  });

  const handleConfirm = () => recipeId && withSession("Не удалось подтвердить шаг", async (sessionId) => {
    setStatus(await confirmStep(recipeId, sessionId));
  });

  const handleJump = (stepIndex: number) => recipeId && withSession("Не удалось перейти на шаг", async (sessionId) => {
    setStatus(await jumpToStep(recipeId, sessionId, stepIndex));
    setResumeHint(null);
  });

  const handleAbort = () => recipeId && withSession("Не удалось прервать процедуру", async (sessionId) => {
    const ok = await confirmModal({
      title: "Прервать процедуру?",
      description: "Текущий шаг останется незавершённым, записанные значения в ПЛК не откатываются.",
      confirmLabel: "Прервать",
      danger: true,
    });
    if (!ok) return;
    await abortProcedure(recipeId, sessionId);
    useProcedureStore.getState().watch(recipeId);
  });

  const isRunning = Boolean(status && !status.completed);
  const elapsed = stepStartedAt != null ? Date.now() - stepStartedAt : 0;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Процедура
            </label>
            <select
              className={cn(
                "w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700",
                "rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
              )}
              value={recipeId ?? ""}
              disabled={isLoading || isRunning}
              onChange={(e) => watch(e.target.value || null)}
            >
              <option value="" disabled>{isLoading ? "Загрузка…" : "Выберите рецепт…"}</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {!isRunning ? (
            <Button variant="primary" onClick={handleStart} disabled={!recipeId || busy}>
              <Play size={16} />
              Запустить
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={handleConfirm} disabled={busy}>
                <ChevronRight size={16} />
                Подтвердить
              </Button>
              <Button variant="danger" onClick={handleAbort} disabled={busy}>
                <CircleStop size={16} />
                Прервать
              </Button>
            </>
          )}
        </div>

        {resumeHint !== null && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <TimerReset size={15} />
              Процедура не найдена в памяти рантайма
            </div>
            <p>
              Вероятно, он был перезапущен. Похоже, процедура остановилась на шаге{" "}
              <b>{resumeHint + 1}</b>
              {steps[resumeHint]?.name ? ` — «${steps[resumeHint].name}»` : ""}. Подсказка может
              ошибаться на шагах с условием по времени или подтверждению — выберите шаг сами,
              если она не подходит.
            </p>
            <Button variant="primary" onClick={() => handleJump(resumeHint)} disabled={busy}>
              Продолжить с шага {resumeHint + 1}
            </Button>
          </div>
        )}

        {status && (
          <div className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            status.completed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : status.stalled
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
          )}>
            <div className="flex items-center gap-2 font-medium">
              {status.completed ? <CheckCircle2 size={15} /> : status.stalled ? <AlertTriangle size={15} /> : null}
              {status.completed
                ? "Процедура завершена"
                : `Шаг ${status.stepIndex + 1}${status.stepName ? ` — ${status.stepName}` : ""}`}
            </div>
            {!status.completed && (
              <div className="text-gray-600 dark:text-gray-400">
                На шаге: {formatElapsed(elapsed)}
                {status.stalled && " · шаг подозрительно долго не завершается"}
              </div>
            )}
          </div>
        )}

        {steps.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  <th className="px-4 py-2.5 font-medium w-12">№</th>
                  <th className="px-4 py-2.5 font-medium">Шаг</th>
                  <th className="px-4 py-2.5 font-medium">Записывает</th>
                  <th className="px-4 py-2.5 font-medium w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70">
                {steps.map((step, index) => {
                  const current = !status?.completed && status?.stepIndex === index;
                  return (
                    <tr key={index} className={cn(current && "bg-blue-500/10")}>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{index + 1}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {step.name || <span className="text-gray-400 italic">без названия</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                        {step.action.length
                          ? step.action.map(a => `${a.tag} = ${String(a.value)}`).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                          disabled={busy || !recipeId}
                          onClick={() => handleJump(index)}
                        >
                          перейти
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!recipeId && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Выберите процедуру, чтобы увидеть её шаги и запустить выполнение.
          </p>
        )}
      </div>
    </div>
  );
}
