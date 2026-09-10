"use client";

import React, {useEffect, useState} from "react";
import {AlertTriangle, CheckCircle2, ChevronRight, CircleStop, Play, TimerReset} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {useRecipeStore} from "@/store/useRecipeStore";
import {useProcedureStore} from "@/store/useProcedureStore";
import {useProcedureControls} from "@/lib/runtime/useProcedureControls";
import {CLOCK_TICK_MS, formatElapsed} from "@/lib/runtime/procedureFormat";

/**
 * Выполнение процедурного рецепта — подробный вид во вкладке «Процедуры».
 *
 * Только представление: действия берутся из `useProcedureControls`, состояние — из
 * `useProcedureStore`, а опрос статуса и уведомления живут в `useProcedureSync`,
 * смонтированном один раз в `MonitorClient`. Повтори их здесь — при открытой вкладке
 * рядом с HUD вышло бы два опроса и по два тоста на событие.
 *
 * Вести уже идущий процесс удобнее из HUD поверх схемы: он не закрывает мнемосхему.
 */
export function ProcedurePanel() {
  const {recipes, loaded, isLoading, loadRecipes} = useRecipeStore();
  const {recipeId, status, stepStartedAt, resumeHint, watch} = useProcedureStore();
  const {busy, start, confirm, jump, abort} = useProcedureControls();

  /**
   * Секундомер шага. Держим готовое число, а не считаем `Date.now()` в теле рендера:
   * рендер обязан быть чистым (`react-hooks/purity`), а тик и так нужен для перерисовки.
   */
  const [elapsed, setElapsed] = useState(0);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;
  const steps = recipe?.steps ?? [];

  useEffect(() => {
    if (!loaded) void loadRecipes();
  }, [loaded, loadRecipes]);

  useEffect(() => {
    const tick = () => setElapsed(stepStartedAt != null ? Date.now() - stepStartedAt : 0);
    tick();
    const id = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [stepStartedAt]);

  const isRunning = Boolean(status && !status.completed);

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
              disabled={isLoading}
              onChange={(e) => watch(e.target.value || null)}
            >
              <option value="" disabled>{isLoading ? "Загрузка…" : "Выберите рецепт…"}</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {!isRunning ? (
            <Button variant="primary" onClick={() => recipeId && start(recipeId)} disabled={!recipeId || busy}>
              <Play size={16} />
              Запустить
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => recipeId && confirm(recipeId)} disabled={busy}>
                <ChevronRight size={16} />
                Подтвердить
              </Button>
              <Button variant="danger" onClick={() => recipeId && abort(recipeId)} disabled={busy}>
                <CircleStop size={16} />
                Прервать
              </Button>
            </>
          )}
        </div>

        {resumeHint !== null && recipeId && (
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
            <Button variant="primary" onClick={() => jump(recipeId, resumeHint)} disabled={busy}>
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
                          onClick={() => recipeId && jump(recipeId, index)}
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
