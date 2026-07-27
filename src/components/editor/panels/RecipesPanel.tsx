"use client";

import React, {useMemo, useState} from "react";
import {Pencil, Plus, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {useEditorStore} from "@/store/useEditorStore";
import {useRecipeStore} from "@/store/useRecipeStore";
import {RecipeDto} from "@/types/recipe.types";
import openRecipeModal from "@/components/editor/recipes/RecipeModal";

export function RecipesPanel() {
  const elements = useEditorStore((s) => s.elements);
  const {recipes, loadRecipes, deleteRecipe} = useRecipeStore();

  const tableComponents = useMemo(
    () => elements.filter((el) => el.type === "table" && el.id != null),
    [elements],
  );

  const [componentId, setComponentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedComponent = tableComponents.find((el) => el.id === componentId);
  const rowBindings = selectedComponent?.type === "table" ? (selectedComponent.rowBindings ?? []).filter(Boolean) : [];

  // Загрузка триггерится выбором в <select>, а не эффектом от componentId —
  // так же, как в MonitorClient.tsx (loadScene по onChange).
  const selectComponent = (id: number | null) => {
    setComponentId(id);
    if (id != null) {
      setIsLoading(true);
      void loadRecipes(id).finally(() => setIsLoading(false));
    }
  };

  const selectClasses = cn(
    "bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg",
    "px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
  );

  const handleDelete = (recipe: RecipeDto) => {
    if (!window.confirm(`Удалить рецепт «${recipe.name}»?`)) return;
    void deleteRecipe(recipe.id);
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Рецепты</h1>

        <div className="flex items-center gap-2">
          <select
            className={selectClasses}
            value={componentId ?? ""}
            onChange={(e) => selectComponent(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="" disabled>Компонент…</option>
            {tableComponents.map((el) => (
              <option key={el.key} value={el.id ?? ""}>{el.label || el.key}</option>
            ))}
          </select>

          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              componentId != null
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed",
            )}
            disabled={componentId == null}
            onClick={() => componentId != null && openRecipeModal({componentId, rowBindings})}
          >
            <Plus size={16} />
            Создать рецепт
          </button>
        </div>
      </div>

      {componentId == null ? (
        <div className="flex min-h-[180px] items-center justify-center text-neutral-500 dark:text-neutral-400 text-sm">
          Выберите компонент (таблицу с привязанными к тегам строками), чтобы увидеть его рецепты
        </div>
      ) : isLoading ? (
        <div className="flex min-h-[180px] items-center justify-center text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Загрузка рецептов...
          </div>
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
          <span className="text-5xl opacity-30">📋</span>
          <p>У этого компонента ещё нет рецептов</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium">Название</th>
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium">Значений</th>
                  <th className="whitespace-nowrap px-5 py-3.5 font-medium text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70 text-sm text-gray-700 dark:text-gray-300">
                {recipes.map((recipe) => (
                  <tr key={recipe.id} className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-gray-100">{recipe.name}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{recipe.values.length}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                          title="Редактировать"
                          onClick={() => componentId != null && openRecipeModal({componentId, rowBindings, recipe})}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors"
                          title="Удалить"
                          onClick={() => handleDelete(recipe)}
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
    </div>
  );
}
