"use client";

import React, {useState} from "react";
import {ListOrdered, Plus, RefreshCw} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Spinner} from "@/shared/ui/Spinner";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {EmptyState} from "@/shared/ui/EmptyState";
import {useEditorStore} from "../../model/editorStore";
import {useRecipes} from "../../api/recipes";
import {Recipe} from "@/core/project";
import openRecipeEditorModal from "./RecipeEditorModal";
import {useCurrentProjectGrant} from "@/core/access";
import {RecipeRow} from "./RecipeRow";
import {RecipeStepEditor} from "./RecipeStepEditor";
import {headClass} from "./tableClasses";
import {useRecipeDrafts} from "./useRecipeDrafts";

/**
 * Процедурные рецепты открытого проекта. Рецепт не принадлежит ни компоненту, ни сцене —
 * он описывает процедуру над тегами, — но принадлежит ПРОЕКТУ и до мойки доезжает только
 * с выпуском (`docs/contract/2026-10-19-recipes-in-project-contract.md`).
 *
 * Состав показывается ЗДЕСЬ ЖЕ, разворотом строки: рецепт не содержимое схемы, и выносить
 * его на холст незачем. Значения уставок правятся прямо в таблице тегов — но всегда
 * в пределах ВЫБРАННОГО шага: собственного значения у тега в контракте нет, оно
 * принадлежит действию шага.
 */
const NO_RECIPES: Recipe[] = []; // общий пустой список: `?? []` давал бы новый массив на каждый рендер

export function RecipesPanel() {
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const recipesQuery = useRecipes(projectId);
  const recipes = recipesQuery.data ?? NO_RECIPES;
  const isLoading = recipesQuery.status !== "success" && recipesQuery.isFetching; // перечитка со списком — фоном
  const loadError = recipesQuery.status === "error" ? recipesQuery.error.message || "Ошибка загрузки рецептов" : null;

  const [expanded, setExpanded] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  // Смотреть — `view`/`edit`, менять — `edit` в этом проекте (иначе бэкенд ответит 403 NO_EDIT).
  const canEditRecipes = useCurrentProjectGrant().edit;
  const {stepsOf, isDirty, dropDraft, editValue, savingId, handleSave, handleDelete} =
    useRecipeDrafts(projectId, () => setExpanded(null));

  const toggle = (recipe: Recipe) => {
    const opening = expanded !== recipe.id;
    setExpanded(opening ? recipe.id : null);
    if (opening) setStepIndex(0);
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        {/* Единый вид заголовка панели (как в «Слоях» и «Свойствах»). */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Рецепты
        </h3>

        {canEditRecipes && <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            "bg-blue-600 text-white hover:bg-blue-500",
          )}
          onClick={() => openRecipeEditorModal()}
        >
          <Plus size={16} />
          Создать рецепт
        </button>}
      </div>

      {projectId == null ? (
        <EmptyState size="sm" title="Выберите проект — рецепты принадлежат проекту." className="min-h-[180px] justify-center" />
      ) : isLoading ? (
        <Spinner size={20} label="Загрузка рецептов…" className="min-h-[180px] justify-center gap-3" />
      ) : loadError ? (
        <Banner
          tone="destructive"
          actions={<Button size="sm" onClick={() => void recipesQuery.refetch()}><RefreshCw size={14} />Повторить</Button>}
        >
          Не удалось загрузить рецепты: {loadError}
        </Banner>
      ) : recipes.length === 0 ? (
        <EmptyState size="sm" icon={ListOrdered} title="Рецептов пока нет" className="min-h-[180px] justify-center" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                <th className="w-10" />
                <th className={cn(headClass, "whitespace-nowrap py-3.5")}>Название</th>
                <th className={cn(headClass, "whitespace-nowrap py-3.5")}>Теги</th>
                <th className={cn(headClass, "whitespace-nowrap py-3.5")}>Шаги</th>
                <th className={cn(headClass, "whitespace-nowrap py-3.5 text-center")}>Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70 text-sm text-gray-700 dark:text-gray-300">
              {recipes.map((recipe) => {
                const isOpen = expanded === recipe.id;
                const steps = stepsOf(recipe);
                const dirty = isDirty(recipe);
                const index = Math.min(stepIndex, Math.max(0, steps.length - 1));
                const step = steps[index];

                return (
                  <React.Fragment key={recipe.id}>
                    <RecipeRow
                      recipe={recipe}
                      isOpen={isOpen}
                      dirty={dirty}
                      stepCount={steps.length}
                      canEditRecipes={canEditRecipes}
                      toggle={toggle}
                      handleDelete={handleDelete}
                    />

                    {isOpen && (
                      <RecipeStepEditor
                        recipe={recipe}
                        steps={steps}
                        index={index}
                        step={step}
                        dirty={dirty}
                        canEditRecipes={canEditRecipes}
                        savingId={savingId}
                        setStepIndex={setStepIndex}
                        dropDraft={dropDraft}
                        handleSave={handleSave}
                        onEditValue={(i, name, v) => editValue(recipe, i, name, v)}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-500">
        Выполняется процедура в мониторе — вкладка «Процедуры». До мойки рецепт доходит только
        с выпуском: после сохранения выпустите проект и назначьте выпуск prod.
      </p>
    </div>
  );
}
