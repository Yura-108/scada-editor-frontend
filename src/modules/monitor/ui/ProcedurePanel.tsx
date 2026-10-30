"use client";

import React, {useEffect, useState} from "react";
import {AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, CircleStop, Package, Pause, Play, RefreshCw} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {EmptyState} from "@/shared/ui/EmptyState";
import {useMonitorRecipes} from "../api/procedures";
import {useProcedureStore} from "../model/useProcedureStore";
import {useProcedureControls} from "../model/procedures/useProcedureControls";
import {CLOCK_TICK_MS, formatElapsed} from "../model/procedures/procedureFormat";
import {useOpenScene} from "@/core/project";
import {ProcedureRecipeSelect} from "./ProcedureRecipeSelect";

/**
 * Выполнение процедурного рецепта — подробный вид во вкладке «Процедуры».
 *
 * Только представление: действия берутся из `useProcedureControls`, состояние — из
 * `useProcedureStore`, а опрос статуса и уведомления живут в `useProcedureSync`,
 * смонтированном один раз в `MonitorClient`. Повтори их здесь — при открытой вкладке
 * рядом с HUD вышло бы два опроса и по два тоста на событие.
 *
 * Вести уже идущий процесс удобнее из HUD поверх схемы: он не закрывает мнемосхему.
 *
 * Список рецептов — из prod-выпуска (`useMonitorRecipes`, TanStack Query): сохранённый
 * в редакторе, но не выпущенный рецепт мойка не знает, и показывать его нельзя.
 */
export function ProcedurePanel() {
  const projectId = useOpenScene(s => s.currentProject?.id ?? null);
  const {recipes, isLoading, loadError, reload} = useMonitorRecipes(projectId, useOpenScene(s => s.releaseVersionNo));
  const {recipeId, status, stepStartedAt, watch} = useProcedureStore();
  const {busy, denied, start, confirm, pause, resume, jump, abort} = useProcedureControls();

  /**
   * Секундомер шага. Держим готовое число, а не считаем `Date.now()` в теле рендера:
   * рендер обязан быть чистым (`react-hooks/purity`), а тик и так нужен для перерисовки.
   */
  const [elapsed, setElapsed] = useState(0);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;
  const steps = recipe?.steps ?? [];

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
            <ProcedureRecipeSelect
              recipes={recipes}
              recipeId={recipeId}
              onWatch={watch}
              disabled={isLoading}
              placeholder={isLoading ? "Загрузка…" : "Выберите рецепт…"}
            />
          </div>

          {!isRunning ? (
            <Button variant="primary" onClick={() => recipeId && start(recipeId)} disabled={!recipeId || busy || !!denied.start} title={denied.start ?? undefined}>
              <Play size={16} />
              Запустить
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => recipeId && confirm(recipeId)} disabled={busy || !!denied.confirm} title={denied.confirm ?? undefined}>
                <ChevronRight size={16} />
                Подтвердить
              </Button>
              {status?.paused ? (
                <Button onClick={() => recipeId && resume(recipeId)} disabled={busy || !!denied.resume} title={denied.resume ?? undefined}>
                  <Play size={16} />
                  Продолжить
                </Button>
              ) : (
                <Button onClick={() => recipeId && pause(recipeId)} disabled={busy || !!denied.pause} title={denied.pause ?? undefined}>
                  <Pause size={16} />
                  Пауза
                </Button>
              )}
              <Button variant="danger" onClick={() => recipeId && abort(recipeId)} disabled={busy || !!denied.abort} title={denied.abort ?? undefined}>
                <CircleStop size={16} />
                Прервать
              </Button>
            </>
          )}
        </div>

        {loadError ? (
          <Banner
            tone="destructive"
            icon={CircleAlert}
            actions={<Button size="sm" onClick={reload} disabled={isLoading}><RefreshCw size={14} />Повторить</Button>}
          >
            Не удалось загрузить рецепты: {loadError}
          </Banner>
        ) : !isLoading && projectId != null && recipes.length === 0 && (
          // Выпуски, сделанные до переноса рецептов в проект, их не содержат — это шаг выката.
          <Banner tone="warning" icon={Package}>
            В prod-выпуске проекта нет рецептов. Создайте их в редакторе, выпустите проект
            и назначьте выпуск prod.
          </Banner>
        )}

        {status && (
          // role="note": время на шаге меняется каждую секунду — объявлять его скринридеру нельзя.
          <Banner
            role="note"
            tone={status.completed ? "success" : status.paused || status.stalled ? "warning" : "info"}
            icon={status.completed ? CheckCircle2 : status.paused ? Pause : status.stalled ? AlertTriangle : Play}
            title={status.completed
              ? "Процедура завершена"
              : `Шаг ${status.stepIndex + 1}${status.stepName ? ` — ${status.stepName}` : ""}`}
          >
            {!status.completed && (
              <div className="text-muted-foreground">
                На шаге: {formatElapsed(elapsed)}
                {status.stalled && " · шаг подозрительно долго не завершается"}
              </div>
            )}
            {/* Причина паузы — отдельной строкой и заметно: по ней оператор решает,
                можно ли продолжать, и она же объясняет отказ «Продолжить». */}
            {status.paused && !status.completed && (
              <div className="mt-1 font-medium text-warning">
                Процедура на паузе{status.pauseReason ? `: ${status.pauseReason}` : ""}
              </div>
            )}
          </Banner>
        )}

        {steps.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium w-12">№</th>
                  <th className="px-4 py-2.5 font-medium">Шаг</th>
                  <th className="px-4 py-2.5 font-medium">Записывает</th>
                  <th className="px-4 py-2.5 font-medium w-28" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {steps.map((step, index) => {
                  const current = !status?.completed && status?.stepIndex === index;
                  return (
                    <tr key={index} className={cn(current && "bg-info/10")}>
                      <td className="px-4 py-2 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-2 text-foreground">
                        {step.name || <span className="text-muted-foreground italic">без названия</span>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {step.action.length
                          ? step.action.map(a => `${a.tag} = ${String(a.value)}`).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="text-xs text-primary hover:underline disabled:opacity-40"
                          disabled={busy || !recipeId || !!denied.jump}
                          title={denied.jump ?? undefined}
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
          <EmptyState size="sm" title="Выберите процедуру, чтобы увидеть её шаги и запустить выполнение." />
        )}
      </div>
    </div>
  );
}
