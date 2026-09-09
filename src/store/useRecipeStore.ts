import {create} from "zustand";
import {toast} from "sonner";
import {Recipe, RecipeCreatePayload} from "@/types/recipe.types";

/**
 * Процедурные рецепты. Список ПЛОСКИЙ: рецепт не принадлежит ни компоненту, ни сцене,
 * ни проекту — фильтра у `GET /api/editor/recipes` больше нет.
 */
type RecipeState = {
  recipes: Recipe[];
  /** Список уже загружен (или грузится): по нему решаем, нужен ли запрос. */
  loaded: boolean;
  /**
   * Флаг живёт в сторе, а не в компоненте: список читают и панель редактора, и панель
   * выполнения в мониторе, и обе иначе завели бы `setState` прямо в эффекте — в этом
   * проекте так не делают (правило `react-hooks/set-state-in-effect` это ловит).
   */
  isLoading: boolean;
  loadRecipes: () => Promise<void>;
  createRecipe: (payload: RecipeCreatePayload) => Promise<Recipe | null>;
  updateRecipe: (id: string, payload: RecipeCreatePayload) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<void>;
};

/**
 * Сообщение об ошибке от бэкенда. Spring отдаёт `{status, error, message, timestamp}`,
 * и `message` у 400-х рецепта содержательный — перечисляет необъявленные теги или
 * несовпавший тип. Показываем его, а не свою формулировку.
 */
const errorMessage = async (res: Response, fallback: string): Promise<string> => {
  const body = await res.json().catch(() => null);
  const raw = body as {message?: unknown; error?: unknown} | null;
  const message = raw?.message ?? raw?.error;
  return typeof message === "string" && message ? message : fallback;
};

const report = (err: unknown, fallback: string) => {
  console.error(err);
  toast.error(err instanceof Error ? err.message : fallback);
};

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loaded: false,
  isLoading: false,

  loadRecipes: async () => {
    set({isLoading: true, loaded: true});
    try {
      const res = await fetch("/api/editor/recipes");
      if (!res.ok) throw new Error(await errorMessage(res, "Ошибка загрузки рецептов"));
      set({recipes: await res.json()});
    } catch (err: unknown) {
      report(err, "Ошибка загрузки рецептов");
      // Отпускаем флаг обратно, иначе повторить загрузку было бы нечем.
      set({recipes: [], loaded: false});
    } finally {
      set({isLoading: false});
    }
  },

  createRecipe: async (payload) => {
    try {
      const res = await fetch("/api/editor/recipes", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Ошибка создания рецепта"));

      const created: Recipe = await res.json();
      set({recipes: [...get().recipes, created]});
      toast.success("Рецепт создан");
      return created;
    } catch (err: unknown) {
      report(err, "Ошибка создания рецепта");
      return null;
    }
  },

  updateRecipe: async (id, payload) => {
    try {
      const res = await fetch(`/api/editor/recipes/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "Ошибка сохранения рецепта"));

      const updated: Recipe = await res.json();
      set({recipes: get().recipes.map(r => r.id === id ? updated : r)});
      toast.success("Рецепт сохранён");
      return updated;
    } catch (err: unknown) {
      report(err, "Ошибка сохранения рецепта");
      return null;
    }
  },

  deleteRecipe: async (id) => {
    try {
      const res = await fetch(`/api/editor/recipes/${encodeURIComponent(id)}`, {method: "DELETE"});
      if (!res.ok) throw new Error(await errorMessage(res, "Ошибка удаления рецепта"));
      set({recipes: get().recipes.filter(r => r.id !== id)});
      toast.success("Рецепт удалён");
    } catch (err: unknown) {
      report(err, "Ошибка удаления рецепта");
    }
  },
}));
