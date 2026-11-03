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
    <div className="max-h-72 overflow-y-auto custom-scrollbar border-t border-border px-3 py-2 space-y-2">
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">У процедуры нет шагов.</p>
      ) : (
        <ul className="space-y-0.5">
          {steps.map((step, index) => {
            const current = !status?.completed && status?.stepIndex === index;
            return (
              <li
                key={index}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                  current ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {step.name || <span className="italic text-muted-foreground">без названия</span>}
                </span>
                <button
                  className="shrink-0 text-primary hover:underline disabled:opacity-40"
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
