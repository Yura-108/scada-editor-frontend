import {create} from "zustand";
import {toast} from "sonner";
import {Recipe, RecipeCreatePayload} from "@/types/recipe.types";
import {readBackendError} from "@/lib/access/accessErrors";

/**
 * Процедурные рецепты ОТКРЫТОГО ПРОЕКТА в редакторе (черновик).
 *
 * Контракт `docs/contract/2026-10-19-recipes-in-project-contract.md`: рецепт принадлежит
 * проекту, смотреть — `view`/`edit`, менять — `edit`. До мойки он доезжает только с новым
 * prod-выпуском, поэтому монитор этот стор НЕ читает — у него свой список из runtime
 * (`useMonitorRecipesStore`), ровно тот, что исполнит процедура.
 */
type RecipeState = {
  /** Проект, для которого загружен (или грузится) `recipes`; `null` — ещё ни для какого. */
  projectId: number | null;
  recipes: Recipe[];
  /**
   * Флаг живёт в сторе, а не в компоненте: иначе панель завела бы `setState` прямо
   * в эффекте — в этом проекте так не делают (правило `react-hooks/set-state-in-effect`).
   */
  isLoading: boolean;
  /**
   * Причина последней неудачной загрузки, `null` — ошибки нет. Хранится отдельно от
   * `projectId`: его сброс при ошибке заставил бы эффект панели тут же звать загрузку
   * снова — бесконечный цикл запросов и тостов на 5xx и обрыве сети.
   * Повтор — только явный, кнопкой «Повторить».
   */
  loadError: string | null;
  loadRecipes: (projectId: number) => Promise<void>;
  createRecipe: (payload: RecipeCreatePayload) => Promise<Recipe | null>;
  updateRecipe: (id: string, payload: RecipeCreatePayload) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<void>;
};

const recipesUrl = (projectId: number) => `/api/editor/projects/${projectId}/recipes`;
const recipeUrl = (projectId: number, id: string) =>
  `${recipesUrl(projectId)}/${encodeURIComponent(id)}`;

/**
 * Текст ошибки бэкенда. У 400-х рецепта `message` содержательный — перечисляет необъявленные
 * теги или несовпавший тип; 403 (`NO_PROJECT_ACCESS` / `NO_EDIT`) переводит `describeDenial`.
 */
const fail = async (res: Response): Promise<never> => {
  throw new Error(await readBackendError(res));
};

const report = (err: unknown, fallback: string) => {
  console.error(err);
  toast.error(err instanceof Error ? err.message : fallback);
};

/** Ответ на запрос, отправленный для другого проекта, в стор не попадает. */
let loadSeq = 0;

export const useRecipeStore = create<RecipeState>((set, get) => ({
  projectId: null,
  recipes: [],
  isLoading: false,
  loadError: null,

  loadRecipes: async (projectId) => {
    const seq = ++loadSeq;
    // Список другого проекта не показываем ни мгновения: он похож на правду.
    set({projectId, recipes: get().projectId === projectId ? get().recipes : [], isLoading: true, loadError: null});
    try {
      const res = await fetch(recipesUrl(projectId));
      if (!res.ok) await fail(res);
      const recipes: Recipe[] = await res.json();
      if (seq === loadSeq) set({recipes});
    } catch (err: unknown) {
      if (seq !== loadSeq) return;
      report(err, "Ошибка загрузки рецептов");
      // `projectId` не сбрасываем — см. `loadError`.
      set({recipes: [], loadError: err instanceof Error ? err.message : "Ошибка загрузки рецептов"});
    } finally {
      if (seq === loadSeq) set({isLoading: false});
    }
  },

  createRecipe: async (payload) => {
    const projectId = get().projectId;
    if (projectId == null) return null;
    try {
      const res = await fetch(recipesUrl(projectId), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) await fail(res);

      const created: Recipe = await res.json();
      if (get().projectId === projectId) set({recipes: [...get().recipes, created]});
      toast.success("Рецепт создан");
      return created;
    } catch (err: unknown) {
      report(err, "Ошибка создания рецепта");
      return null;
    }
  },

  updateRecipe: async (id, payload) => {
    const projectId = get().projectId;
    if (projectId == null) return null;
    try {
      const res = await fetch(recipeUrl(projectId, id), {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) await fail(res);

      const updated: Recipe = await res.json();
      if (get().projectId === projectId) set({recipes: get().recipes.map(r => r.id === id ? updated : r)});
      toast.success("Рецепт сохранён");
      return updated;
    } catch (err: unknown) {
      report(err, "Ошибка сохранения рецепта");
      return null;
    }
  },

  deleteRecipe: async (id) => {
    const projectId = get().projectId;
    if (projectId == null) return;
    try {
      const res = await fetch(recipeUrl(projectId, id), {method: "DELETE"});
      if (!res.ok) await fail(res);
      if (get().projectId === projectId) set({recipes: get().recipes.filter(r => r.id !== id)});
      toast.success("Рецепт удалён");
    } catch (err: unknown) {
      report(err, "Ошибка удаления рецепта");
    }
  },
}));
