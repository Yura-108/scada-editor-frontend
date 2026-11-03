"use client";

import React from "react";
import {Save, Undo2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import type {Recipe, RecipeStep} from "@/core/project";
import {RecipeTagValuesTable} from "./RecipeTagValuesTable";

/**
 * Раскрытая строка рецепта: выбор шага и значения тегов на нём — всегда в пределах выбранного
 * шага, собственного значения у тега нет. «Сбросить» и «Сохранить» — с правом правки.
 */
export function RecipeStepEditor({recipe, steps, index, step, dirty, canEditRecipes, savingId, setStepIndex, dropDraft, handleSave, onEditValue}: {
  recipe: Recipe;
  steps: RecipeStep[];
  index: number;
  step: RecipeStep | undefined;
  dirty: boolean;
  canEditRecipes: boolean;
  savingId: string | null;
  setStepIndex: (index: number) => void;
  dropDraft: (id: string) => void;
  handleSave: (recipe: Recipe) => Promise<void>;
  onEditValue: (index: number, tagName: string, text: string) => void;
}) {
  const tags = recipe.tags ?? [];
  return (
    <tr className="bg-muted/40">
      <td colSpan={5} className="px-6 py-4 space-y-5">
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            У рецепта нет шагов — задавать значения негде.
          </p>
        ) : (
          <>
            {/* ─── Выбор шага ─── */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Шаг
              </span>
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStepIndex(i)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    i === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                  )}
                >
                  {i + 1}. {s.name || "без названия"}
                </button>
              ))}
            </div>

            {/* ─── Манифест со значениями выбранного шага ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Теги и значения на шаге {index + 1}
                </span>
                {canEditRecipes && <div className="flex items-center gap-2">
                  {dirty && (
                    <button
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                      onClick={() => dropDraft(recipe.id)}
                    >
                      <Undo2 size={14} />
                      Сбросить
                    </button>
                  )}
                  <button
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                      dirty && savingId !== recipe.id
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground cursor-not-allowed",
                    )}
                    disabled={!dirty || savingId === recipe.id}
                    onClick={() => void handleSave(recipe)}
                  >
                    <Save size={14} />
                    {savingId === recipe.id ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>}
              </div>

              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Манифест пуст — шагам нечего записывать.
                </p>
              ) : (
                <RecipeTagValuesTable tags={tags} step={step} onChange={(name, v) => onEditValue(index, name, v)} />
              )}
              <p className="text-xs text-muted-foreground">
                Пустое поле — тег на этом шаге не записывается. Условие перехода
                и таймаут шага правятся в редакторе рецепта.
              </p>
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
