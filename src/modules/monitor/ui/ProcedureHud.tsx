"use client";

import React from "react";
import {AlertTriangle, ChevronDown, ChevronUp, GripVertical} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {useMonitorRecipes} from "../api/procedures";
import {useProcedureStore} from "../model/useProcedureStore";
import {useProcedureControls} from "../model/procedures/useProcedureControls";
import {formatElapsed} from "../model/procedures/procedureFormat";
import {useHudPosition} from "../model/procedures/useHudPosition";
import {useStepElapsed} from "../model/procedures/useStepElapsed";
import {useOpenScene} from "@/core/project";
import {ProcedureRecipeSelect} from "./ProcedureRecipeSelect";
import {HudControls, hudIconButton} from "./procedure-hud/HudControls";
import {HudSteps} from "./procedure-hud/HudSteps";

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
  const controls = useProcedureControls();

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

        {recipeId && (
          <HudControls recipeId={recipeId} status={status} isRunning={isRunning} controls={controls} />
        )}

        <button
          className={cn(hudIconButton, "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800")}
          onClick={toggleCollapsed}
          title={prefs.collapsed ? "Показать шаги" : "Свернуть"}
        >
          {prefs.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* ─── Развёрнутая часть: шаги ─── */}
      {!prefs.collapsed && recipeId && (
        <HudSteps recipeId={recipeId} steps={steps} status={status} controls={controls} />
      )}
    </div>
  );
}
