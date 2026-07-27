import {create} from "zustand";
import {toast} from "sonner";
import {RecipeCreateDto, RecipeDto} from "@/types/recipe.types";

type RecipeState = {
  recipes: RecipeDto[];
  loadRecipes: (componentId: number) => Promise<void>;
  createRecipe: (recipe: RecipeCreateDto) => Promise<void>;
  updateRecipe: (id: number, recipe: RecipeCreateDto) => Promise<void>;
  deleteRecipe: (id: number) => Promise<void>;
};

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loadRecipes: async (componentId) => {
    try {
      const res = await fetch(`/api/editor/recipes?componentId=${componentId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Ошибка загрузки рецептов");
      }
      const recipes: RecipeDto[] = await res.json();
      set({recipes});
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка загрузки рецептов");
    }
  },
  createRecipe: async (recipe) => {
    try {
      const res = await fetch("/api/editor/recipes", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(recipe),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Ошибка создания рецепта");
      }
      const created: RecipeDto = await res.json();
      set({recipes: [...get().recipes, created]});
      toast.success("Рецепт создан");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка создания рецепта");
    }
  },
  updateRecipe: async (id, recipe) => {
    try {
      const res = await fetch(`/api/editor/recipes/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(recipe),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Ошибка обновления рецепта");
      }
      const updated: RecipeDto = await res.json();
      set({recipes: get().recipes.map(r => r.id === id ? updated : r)});
      toast.success("Рецепт обновлён");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка обновления рецепта");
    }
  },
  deleteRecipe: async (id) => {
    try {
      const res = await fetch(`/api/editor/recipes/${id}`, {method: "DELETE"});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Ошибка удаления рецепта");
      }
      set({recipes: get().recipes.filter(r => r.id !== id)});
      toast.success("Рецепт удалён");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Ошибка удаления рецепта");
    }
  },
}));
