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
import {sortByRow} from "@/lib/editor/rowBinding";

interface Props {
  sessionId: string;
}

type ApplyStatus = "ok" | "partial" | "error";

const applyStatusOf = (result: RecipeApplyResultDto): ApplyStatus =>
  result.failed === 0 && result.unmatchedRows.length === 0 ? "ok"
  : result.sent + result.localApplied === 0 ? "error"
  : "partial";

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
  const [applyResult, setApplyResult] = useState<RecipeApplyResultDto | null>(null);

  const selectedComponent = tableComponents.find((el) => el.id === componentId);
  const rowBindings = selectedComponent?.type === "table"
    ? sortByRow(selectedComponent.properties ?? [])
    : [];
  const selectedRecipe = recipes.find((r) => r.id === recipeId);
  const projectId = useEditorStore((s) => s.currentProject?.id ?? null);

  // Загрузка триггерится выбором в <select>, а не эффектом от componentId/recipeId
  // (тот же приём, что и в RecipesPanel — избегает setState прямо в эффекте).
  const selectComponent = (id: number | null) => {
    setComponentId(id);
    setRecipeId(null);
    setSnapshot(null);
    setApplyResult(null);
    if (id != null) {
      setIsLoadingRecipes(true);
      void loadRecipes(id).finally(() => setIsLoadingRecipes(false));
    }
  };

  const selectRecipe = (id: number | null) => {
    setRecipeId(id);
    setSnapshot(null);
    setApplyResult(null);
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
  const recipeValueByRowName = new Map((selectedRecipe?.values ?? []).map((v) => [v.row_name, v.value]));

  const handleApply = async () => {
    if (recipeId == null) return;
    if (!window.confirm(`Записать рецепт «${selectedRecipe?.name ?? ""}» в ПЛК? Действие необратимо.`)) return;

    setIsApplying(true);
    setApplyResult(null);
    try {
      // Ответ теперь ждёт подтверждения брокера (дедлайн ~7с на бэкенде + резолв
      // набора) — таймаут с запасом, дефолтные 5-10с дали бы сетевую ошибку на
      // успешно применённом рецепте.
      const res = await fetch("/api/runtime/recipes/apply", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({recipeId, sessionId, projectId}),
        signal: AbortSignal.timeout(20_000),
      });
      const result: RecipeApplyResultDto | null = await res.json().catch(() => null);
      if (!res.ok || !result) throw new Error("Ошибка применения рецепта");
      setApplyResult(result);
    } catch (err) {
      console.error(err);
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      toast.error(isTimeout
        ? "Не дождались ответа за 20 с — проверьте результат вручную, рецепт мог всё же примениться"
        : (err instanceof Error ? err.message : "Ошибка применения рецепта"));
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
                      <tr key={rb.name}>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{rb.name}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                          {rb.tag_id ? (currentValueByTag.get(rb.tag_id) ?? "нет данных") : (rb.default_value ?? "—")}
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{recipeValueByRowName.get(rb.name) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {applyResult && (() => {
          const status = applyStatusOf(applyResult);
          return (
            <div
              className={cn(
                "space-y-1.5 rounded-xl border px-4 py-3 text-sm",
                status === "ok" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                status === "partial" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                status === "error" && "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
              )}
            >
              <div className="font-medium">
                {status === "ok" && "Рецепт применён полностью"}
                {status === "partial" && "Рецепт применён частично"}
                {status === "error" && "Не удалось применить рецепт"}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                В ПЛК: {applyResult.sent}, локально: {applyResult.localApplied}, всего: {applyResult.total}
              </div>
              {applyResult.failedRows.length > 0 && (
                <div>Не применились: {applyResult.failedRows.join(", ")}</div>
              )}
              {applyResult.unmatchedRows.length > 0 && (
                <div>Строк нет в таблице (набор устарел): {applyResult.unmatchedRows.join(", ")}</div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="shrink-0 mt-6 pt-4 flex items-center gap-3 justify-end border-t border-gray-200 dark:border-gray-800/80">
        {recipeId != null && !applyResult && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} />
            Запись в ПЛК необратима
          </span>
        )}
        {applyResult ? (
          <button
            onClick={closeModal}
            className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/30 transition-all"
          >
            Готово
          </button>
        ) : (
          <>
            <button
              onClick={closeModal}
              className="px-5 py-2.5 rounded-lg font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleApply}
              disabled={recipeId == null || isApplying}
              className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-gray-400 disabled:to-gray-400 text-white shadow-lg shadow-red-500/30 disabled:shadow-none transition-all flex items-center gap-2"
            >
              {isApplying && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {isApplying ? "Применение..." : "Применить в ПЛК"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function openApplyRecipeModal(props: Props) {
  const {openModal} = useModalStore.getState();
  openModal(<ApplyRecipeModalContent {...props} />);
}
