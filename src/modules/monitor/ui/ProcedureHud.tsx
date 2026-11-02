"use client";

import React from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, CircleStop, GripVertical, Pause, Play,
} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {useMonitorRecipes} from "../api/procedures";
import {useProcedureStore} from "../model/useProcedureStore";
import {useProcedureControls} from "../model/procedures/useProcedureControls";
import {formatElapsed} from "../model/procedures/procedureFormat";
import {useHudPosition} from "../model/procedures/useHudPosition";
import {useStepElapsed} from "../model/procedures/useStepElapsed";
import {useOpenScene} from "@/core/project";
import {ProcedureRecipeSelect} from "./ProcedureRecipeSelect";

/**
 * Ведение процедуры ПОВЕРХ мнемосхемы.
 *
 * Раньше состояние и кнопки жили только во вкладке «Процедуры», а она подменяет собой холст:
 * чтобы подтвердить шаг, оператор уходил со схемы и переставал видеть процесс, которым
 * управляет. HUD снимает этот выбор — вести и наблюдать можно одновременно.
 *
 * Своего поведения у него нет: действия — `useProcedureControls`, состояние — `useProcedureStore`,
 * рецепты prod-выпуска — `useMonitorRecipes`, опрос и уведомления — `useProcedureSync` (MonitorClient).
 */
export function ProcedureHud() {
  const {recipes} = useMonitorRecipes(useOpenScene(s => s.currentProject?.id ?? null), useOpenScene(s => s.releaseVersionNo));
  const {recipeId, status, stepStartedAt, watch} = useProcedureStore();
  const {busy, denied, start, confirm, pause, resume, jump, abort} = useProcedureControls();

  const {hudRef, prefs, hydrated, handleDragStart, toggleCollapsed} = useHudPosition();
  const elapsed = useStepElapsed(stepStartedAt);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;
  const steps = recipe?.steps ?? [];

  const isRunning = Boolean(status && !status.completed);

  // Пауза важнее «завис»: стоящая мойка не должна выглядеть идущей, поэтому пульсацию
  // снимаем — она и означает «процесс идёт».
  const dotClass = !status ? "bg-neutral-400"
    : status.completed ? "bg-emerald-500"
    : status.paused ? "bg-amber-500"
    : status.stalled ? "bg-amber-500"
    : "bg-blue-500 animate-pulse";

  const iconButton = cn(
    "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  );

  return (
    <div
      ref={hudRef}
      role="region"
      aria-label="Управление процедурой"
      className={cn(
        "absolute z-toolbar w-max min-w-[min(720px,calc(100%-1rem))] max-w-[min(980px,calc(100%-1rem))]",
        "rounded-xl border border-neutral-200 dark:border-neutral-800",
        "bg-white/95 dark:bg-neutral-900/95 shadow-2xl backdrop-blur-xl",
        // До чтения настройки не показываем: иначе окно прыгнуло бы из угла в угол.
        hydrated ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{left: prefs.x, top: prefs.y}}
    >
      {/* ─── Свёрнутая полоска: в ней уже есть всё для ведения процесса ─── */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div
          onPointerDown={handleDragStart}
          className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 touch-none"
          title="Перетащить"
        >
          <GripVertical size={16} />
        </div>

        {/* Переключать рецепт можно и на ходу: процедура на бэкенде живёт под ключом
            (проект, рецепт), и смена выбора меняет лишь то, за чем мы наблюдаем —
            запущенная продолжает идти, а по возвращении её состояние вернёт GET /status. */}
        <ProcedureRecipeSelect
          className="w-56 shrink-0"
          recipes={recipes}
          recipeId={recipeId}
          onWatch={watch}
          placeholder="Процедура…"
        />

        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />

        <span className="min-w-0 flex-1 truncate text-xs text-neutral-700 dark:text-neutral-300">
          {!recipeId ? "процедура не выбрана"
            : !status ? "не запущена"
            : status.completed ? "завершена"
            : `Шаг ${status.stepIndex + 1}/${steps.length || "?"}`
              + `${status.stepName ? ` · ${status.stepName}` : ""} · ${formatElapsed(elapsed)}`
              // Причину показываем всегда: авария могла уйти сама (пауза выключила насос),
              // и без неё оператор видит стоящую мойку без объяснения.
              + `${status.paused ? ` · ПАУЗА${status.pauseReason ? `: ${status.pauseReason}` : ""}` : ""}`}
        </span>

        {status?.stalled && (
          <span className="shrink-0 text-amber-600 dark:text-amber-400" title="Шаг долго не завершается">
            <AlertTriangle size={14} />
          </span>
        )}

        {recipeId && !isRunning && (
          <button
            className={cn(iconButton, "gap-1 px-2 bg-blue-600 text-white hover:bg-blue-500")}
            disabled={busy || !!denied.start}
            onClick={() => start(recipeId)}
            title={denied.start ?? "Запустить процедуру"}
          >
            <Play size={13} />
            <span className="text-xs font-medium">Запустить</span>
          </button>
        )}

        {recipeId && isRunning && (
          <>
            <button
              className={cn(iconButton, "gap-1 px-2 bg-blue-600 text-white hover:bg-blue-500")}
              disabled={busy || !!denied.confirm}
              onClick={() => confirm(recipeId)}
              title={denied.confirm ?? "Подтвердить текущий шаг"}
            >
              <Check size={13} />
              <span className="text-xs font-medium">Подтвердить</span>
            </button>
            {/* Пауза настоящая, серверная: рантайм переводит оборудование в `pause_action`
                рецепта и останавливает продвижение по шагам. На паузу процедура встаёт и
                сама, пока активна авария, — тогда «Продолжить» ответит отказом с её текстом,
                и это не сбой, а причина, по которой продолжать нельзя. */}
            {status?.paused ? (
              <button
                className={cn(iconButton, "gap-1 px-2 bg-emerald-600 text-white hover:bg-emerald-500")}
                disabled={busy || !!denied.resume}
                onClick={() => resume(recipeId)}
                title={denied.resume ?? "Продолжить процедуру: теги безопасного состояния вернутся к значениям текущего шага"}
              >
                <Play size={13} />
                <span className="text-xs font-medium">Продолжить</span>
              </button>
            ) : (
              <button
                className={cn(iconButton, "gap-1 px-2 bg-amber-600 text-white hover:bg-amber-500")}
                disabled={busy || !!denied.pause}
                onClick={() => pause(recipeId)}
                title={denied.pause ?? "Пауза: оборудование перейдёт в безопасное состояние рецепта"}
              >
                <Pause size={13} />
                <span className="text-xs font-medium">Пауза</span>
              </button>
            )}
            <button
              className={cn(iconButton, "bg-red-600 text-white hover:bg-red-500")}
              disabled={busy || !!denied.abort}
              onClick={() => abort(recipeId)}
              title={denied.abort ?? "Прервать процедуру"}
            >
              <CircleStop size={14} />
            </button>
          </>
        )}

        <button
          className={cn(iconButton, "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          onClick={toggleCollapsed}
          title={prefs.collapsed ? "Показать шаги" : "Свернуть"}
        >
          {prefs.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* ─── Развёрнутая часть: шаги ─── */}
      {!prefs.collapsed && recipeId && (
        <div className="max-h-72 overflow-y-auto custom-scrollbar border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 space-y-2">
          {steps.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">У процедуры нет шагов.</p>
          ) : (
            <ul className="space-y-0.5">
              {steps.map((step, index) => {
                const current = !status?.completed && status?.stepIndex === index;
                return (
                  <li
                    key={index}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                      current ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "text-neutral-600 dark:text-neutral-400",
                    )}
                  >
                    <span className="w-5 shrink-0 tabular-nums text-neutral-400">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {step.name || <span className="italic text-neutral-400">без названия</span>}
                    </span>
                    <button
                      className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                      disabled={busy || !!denied.jump}
                      onClick={() => jump(recipeId, index)}
                      title={denied.jump ?? undefined}
                    >
                      перейти
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
