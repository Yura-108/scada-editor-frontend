"use client";

import React, {useEffect} from "react";
import {ListOrdered, Pencil, Plus, Table2, Tags, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {useRecipeStore} from "@/store/useRecipeStore";
import {Recipe} from "@/types/recipe.types";
import openRecipeEditorModal from "@/components/editor/recipes/RecipeEditorModal";
import {showRecipeManifestTable} from "@/lib/editor/recipeTableAction";
import {confirmModal} from "@/components/ui/ConfirmModal";

/**
 * Процедурные рецепты. Список плоский: рецепт не принадлежит ни компоненту, ни сцене —
 * он описывает процедуру над тегами проекта.
 */
export function RecipesPanel({onOpenEditor}: {onOpenEditor?: () => void} = {}) {
  const {recipes, loaded, isLoading, loadRecipes, deleteRecipe} = useRecipeStore();

  // Флага загрузки в компоненте нет намеренно: он в сторе, иначе это был бы `setState`
  // прямо в эффекте (`loaded` ставится до запроса и гасит повторный вызов).
  useEffect(() => {
    if (!loaded) void loadRecipes();
  }, [loaded, loadRecipes]);

  const handleDelete = async (recipe: Recipe) => {
    const confirmed = await confirmModal({
      title: `Удалить рецепт «${recipe.name}»?`,
      description: "Процедура и все её шаги будут удалены безвозвратно.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (confirmed) void deleteRecipe(recipe.id);
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        {/* Единый вид заголовка панели (как в «Слоях» и «Свойствах»). */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          Рецепты
        </h3>

        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            "bg-blue-600 text-white hover:bg-blue-500",
          )}
          onClick={() => openRecipeEditorModal()}
        >
          <Plus size={16} />
          Создать рецепт
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[180px] items-center justify-center text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загрузка рецептов...
          </div>
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
          <span className="text-5xl opacity-30">📋</span>
          <p>Рецептов пока нет</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium">Название</th>
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium">Теги</th>
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium">Шаги</th>
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70 text-sm text-gray-700 dark:text-gray-300">
                {recipes.map((recipe) => (
                  <tr key={recipe.id} className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-gray-100">
                      {recipe.name}
                      <div className="text-xs font-normal text-gray-400 dark:text-gray-600">{recipe.id}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Tags size={14} />{recipe.tags?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <ListOrdered size={14} />{recipe.steps?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
                          title="Редактировать"
                          onClick={() => openRecipeEditorModal({recipe})}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          title="Показать манифест таблицей на сцене «Рецепты»"
                          onClick={() => void showRecipeManifestTable(recipe).then(ok => ok && onOpenEditor?.())}
                        >
                          <Table2 size={16} />
                        </button>
                        <button
                          className="text-red-600 dark:text-red-400 hover:text-red-500 transition-colors"
                          title="Удалить"
                          onClick={() => void handleDelete(recipe)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-500">
        Выполняется процедура в мониторе — вкладка «Процедуры».
      </p>
    </div>
  );
}
