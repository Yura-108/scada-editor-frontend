import React from "react";
import {cn} from "@/shared/lib/cn";
import type {ProcedureStatus, RecipeStep} from "@/core/project";
import type {ProcedureControls} from "./HudControls";

interface Props {
  recipeId: string;
  steps: RecipeStep[];
  status: ProcedureStatus | null;
  controls: ProcedureControls;
}

/** Развёрнутая часть HUD: шаги процедуры с переходом к шагу. */
export function HudSteps({recipeId, steps, status, controls}: Props) {
  const {busy, denied, jump} = controls;

  return (
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
  );
}
