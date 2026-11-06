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

  const {hudRef, prefs, style, hydrated, handleDragStart, toggleCollapsed} = useHudPosition(recipeId);
  const elapsed = useStepElapsed(stepStartedAt);

  const recipe = recipes.find(r => r.id === recipeId) ?? null;
  const steps = recipe?.steps ?? [];

  const isRunning = Boolean(status && !status.completed);

  // Пауза важнее «завис»: стоящая мойка не должна выглядеть идущей, поэтому пульсацию
  // снимаем — она и означает «процесс идёт».
  const dotClass = !status ? "bg-muted-foreground"
    : status.completed ? "bg-success"
    : status.paused ? "bg-warning"
    : status.stalled ? "bg-warning"
    : "bg-primary animate-pulse";

  return (
    <div
      ref={hudRef}
      role="region"
      aria-label="Управление процедурой"
      className={cn(
        "absolute z-toolbar w-max max-w-[min(980px,calc(100%-1rem))]",
        // Без рецепта — только выбор рецепта: широкая плашка закрывала верх схемы (#6 п. 1).
        recipeId && "min-w-[min(720px,calc(100%-1rem))]",
        "rounded-xl border border-border",
        "bg-card/95 shadow-2xl backdrop-blur-xl",
        // До чтения настройки не показываем: иначе окно прыгнуло бы из угла в угол.
        hydrated ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={style}
    >
      {/* ─── Свёрнутая полоска: в ней уже есть всё для ведения процесса ─── */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div
          onPointerDown={handleDragStart}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
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
          placeholder="Рецепт…"
        />

        {/* Пока рецепт не выбран, плашка — только выбор рецепта: статуса, кнопок и шагов
            ещё нет, а широкая полоса закрывала верх схемы (#6 п. 1). */}
        {recipeId && (
          <>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />

            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {!status ? "не запущена"
                : status.completed ? "завершена"
                : `Шаг ${status.stepIndex + 1}/${steps.length || "?"}`
                  + `${status.stepName ? ` · ${status.stepName}` : ""} · ${formatElapsed(elapsed)}`
                  // Причину показываем всегда: авария могла уйти сама (пауза выключила насос),
                  // и без неё оператор видит стоящую мойку без объяснения.
                  + `${status.paused ? ` · ПАУЗА${status.pauseReason ? `: ${status.pauseReason}` : ""}` : ""}`}
            </span>

            {status?.stalled && (
              <span className="shrink-0 text-warning" title="Шаг долго не завершается">
                <AlertTriangle size={14} />
              </span>
            )}

            <HudControls recipeId={recipeId} status={status} isRunning={isRunning} controls={controls} />

            <button
              className={cn(hudIconButton, "text-muted-foreground hover:bg-accent")}
              onClick={toggleCollapsed}
              title={prefs.collapsed ? "Показать шаги" : "Свернуть"}
            >
              {prefs.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </>
        )}
      </div>

      {/* ─── Развёрнутая часть: шаги ─── */}
      {!prefs.collapsed && recipeId && (
        <HudSteps recipeId={recipeId} steps={steps} status={status} controls={controls} />
      )}
    </div>
  );
}
