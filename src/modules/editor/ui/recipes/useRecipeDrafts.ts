import {useState} from "react";
import {toast} from "sonner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import type {Recipe, RecipeStep} from "@/core/project";
import {useRecipeMutations} from "../../api/recipes";
import {setStepValueAt, stepsChanged} from "../../lib/recipeSteps";
import {validateRecipe} from "../../lib/recipeValidation";

/**
 * Черновики значений шагов по рецептам проекта: правка значения тега в шаге, сброс,
 * сохранение с проверкой, удаление рецепта. Черновик не теряется при сворачивании строки
 * и сбрасывается при смене проекта (`onProjectChange` — раскрытая строка панели тоже).
 */
export function useRecipeDrafts(projectId: number | null, onProjectChange: () => void) {
  const {updateRecipe, deleteRecipe} = useRecipeMutations(projectId);
  /** Незасохранённые правки шагов по рецептам. Черновик не теряется при сворачивании. */
  const [drafts, setDrafts] = useState<Record<string, RecipeStep[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Черновики шагов и раскрытая строка принадлежат рецептам прежнего проекта: id-слаги
  // в разных проектах совпадают («дезинфекция»), и черновик молча уехал бы в чужой рецепт.
  // Сброс — по смене проекта во время рендера, а не в эффекте (`set-state-in-effect`).
  const [draftsFor, setDraftsFor] = useState(projectId);
  if (draftsFor !== projectId) {
    setDraftsFor(projectId);
    setDrafts({});
    onProjectChange();
  }

  const stepsOf = (recipe: Recipe): RecipeStep[] => drafts[recipe.id] ?? recipe.steps ?? [];
  const isDirty = (recipe: Recipe) => drafts[recipe.id] !== undefined;

  const dropDraft = (id: string) =>
    setDrafts(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });

  const editValue = (recipe: Recipe, index: number, tagName: string, text: string) => {
    const tag = (recipe.tags ?? []).find(t => t.name === tagName);
    if (!tag) return;

    const next = setStepValueAt(stepsOf(recipe), index, tag, text);
    // Правка, вернувшая всё к исходному, снимает и признак «не сохранено» —
    // иначе кнопка звала бы сохранять то, что и так лежит на сервере.
    if (!stepsChanged(next, recipe.steps ?? [])) dropDraft(recipe.id);
    else setDrafts(prev => ({...prev, [recipe.id]: next}));
  };

  const handleSave = async (recipe: Recipe) => {
    const steps = stepsOf(recipe);
    const problems = validateRecipe({name: recipe.name, tags: recipe.tags, steps});
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }

    setSavingId(recipe.id);
    try {
      // `pause_action` здесь НЕ шлём намеренно: для бэкенда отсутствие поля означает
      // «оставить прежнее», а пустой массив — «очистить». Эта панель правит только значения
      // шагов и о безопасном состоянии ничего не знает; добавив сюда `pause_action: []`,
      // мы бы молча стирали его при каждом сохранении значений. Правится оно в форме рецепта.
      const saved = await updateRecipe(recipe.id, {name: recipe.name, tags: recipe.tags, steps});
      if (saved) dropDraft(recipe.id);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (recipe: Recipe) => {
    const confirmed = await confirmModal({
      title: `Удалить рецепт «${recipe.name}»?`,
      description: "Процедура и все её шаги будут удалены безвозвратно.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (confirmed) {
      dropDraft(recipe.id);
      void deleteRecipe(recipe.id);
    }
  };

  return {stepsOf, isDirty, dropDraft, editValue, savingId, handleSave, handleDelete};
}

export type RecipeDrafts = ReturnType<typeof useRecipeDrafts>;
