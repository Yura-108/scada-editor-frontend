"use client";

import React, {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertTriangle} from "lucide-react";
import {toast} from "sonner";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useEditorStore} from "@/store/useEditorStore";
import {useRecipeStore} from "@/store/useRecipeStore";
import {RecipeApplyResultDto, SnapshotTagValueDto} from "@/types/recipe.types";

interface Props {
  sessionId: string;
}

function ApplyRecipeModalContent({sessionId}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const elements = useEditorStore((s) => s.elements);
  const {recipes, loadRecipes} = useRecipeStore();

  const tableComponents = elements.filter((el) => el.type === "table" && el.id != null);

  const [componentId, setComponentId] = useState<number | null>(null);
  const [recipeId, setRecipeId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotTagValueDto[] | null>(null);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const selectedComponent = tableComponents.find((el) => el.id === componentId);
  const rowBindings = selectedComponent?.type === "table" ? (selectedComponent.rowBindings ?? []).filter(Boolean) : [];
  const selectedRecipe = recipes.find((r) => r.id === recipeId);

  // Загрузка триггерится выбором в <select>, а не эффектом от componentId/recipeId
  // (тот же приём, что и в RecipesPanel — избегает setState прямо в эффекте).
  const selectComponent = (id: number | null) => {
    setComponentId(id);
    setRecipeId(null);
    setSnapshot(null);
    if (id != null) {
      setIsLoadingRecipes(true);
      void loadRecipes(id).finally(() => setIsLoadingRecipes(false));
    }
  };

  const selectRecipe = (id: number | null) => {
    setRecipeId(id);
    setSnapshot(null);
    if (id != null && componentId != null) {
      setIsLoadingSnapshot(true);
      fetch(`/api/runtime/sessions/${sessionId}/snapshot?componentId=${componentId}`)
        .then((res) => {
          if (!res.ok) throw new Error(`snapshot → ${res.status}`);
          return res.json();
        })
        .then((data: SnapshotTagValueDto[]) => setSnapshot(data))
        .catch((err) => {
          console.error(err);
          toast.error("Не удалось получить текущие значения");
        })
        .finally(() => setIsLoadingSnapshot(false));
    }
  };

  const currentValueByTag = new Map((snapshot ?? []).map((s) => [s.tagId, s.value]));
  const recipeValueByTag = new Map((selectedRecipe?.values ?? []).map((v) => [v.tag_id, v.value]));

  const handleApply = async () => {
    if (recipeId == null) return;
    if (!window.confirm(`Записать рецепт «${selectedRecipe?.name ?? ""}» в ПЛК? Действие необратимо.`)) return;

    setIsApplying(true);
    try {
      const res = await fetch("/api/runtime/recipes/apply", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({recipeId}),
      });
      const result: RecipeApplyResultDto = await res.json();
      if (!res.ok) throw new Error("Ошибка применения рецепта");

      if (result.failed === 0) {
        toast.success(`Рецепт применён: ${result.sent}/${result.total} тегов записано`);
      } else {
        toast.error(`Применено с ошибками: ${result.sent}/${result.total}, не удалось: ${result.failedTags.join(", ")}`);
      }
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Ошибка применения рецепта");
    } finally {
      setIsApplying(false);
    }
  };

  const selectClasses = cn(
    "w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg",
    "px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
  );

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          Применить рецепт
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Запись значений рецепта в ПЛК. Сверьте с текущими значениями перед применением.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Компонент
          </label>
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
        </div>

        {componentId != null && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
              Рецепт
            </label>
            <select
              className={selectClasses}
              value={recipeId ?? ""}
              disabled={isLoadingRecipes}
              onChange={(e) => selectRecipe(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="" disabled>{isLoadingRecipes ? "Загрузка…" : "Рецепт…"}</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {recipeId != null && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-600 dark:text-neutral-400 uppercase tracking-wider">
              Сравнение значений
            </h4>
            {isLoadingSnapshot ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Загрузка текущих значений...
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">
                      <th className="px-4 py-2.5 font-medium">Параметр</th>
                      <th className="px-4 py-2.5 font-medium">Текущее</th>
                      <th className="px-4 py-2.5 font-medium">Рецепт</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70">
                    {rowBindings.map((rb) => (
                      <tr key={rb.tag_id}>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{rb.name}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{currentValueByTag.get(rb.tag_id) ?? "—"}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{recipeValueByTag.get(rb.tag_id) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 mt-6 pt-4 flex items-center gap-3 justify-end border-t border-gray-200 dark:border-gray-800/80">
        {recipeId != null && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} />
            Запись в ПЛК необратима
          </span>
        )}
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleApply}
          disabled={recipeId == null || isApplying}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-gray-400 disabled:to-gray-400 text-white shadow-lg shadow-red-500/30 disabled:shadow-none transition-all"
        >
          {isApplying ? "Применение..." : "Применить в ПЛК"}
        </button>
      </div>
    </div>
  );
}

export default function openApplyRecipeModal(props: Props) {
  const {openModal} = useModalStore.getState();
  openModal(<ApplyRecipeModalContent {...props} />);
}
