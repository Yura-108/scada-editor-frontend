import {toast} from "sonner";
import {useEditorStore} from "@/store/useEditorStore";
import {ensureRecipesScene, RECIPES_SCENE_NAME} from "@/lib/editor/recipeScene";
import {recipeIdOf} from "@/lib/editor/recipeTable";
import type {Recipe} from "@/types/recipe.types";

/**
 * Показать манифест рецепта таблицей на сцене «Рецепты».
 *
 * Если таблица этого рецепта там уже есть — просто наводим на неё, а не плодим вторую.
 * Пересборка под изменившийся манифест намеренно требует удалить старую таблицу руками:
 * молча заменить элемент значило бы потерять его положение и оформление, которые
 * пользователь мог настроить.
 *
 * @returns удалось ли показать (false — переход на сцену не состоялся).
 */
export async function showRecipeManifestTable(recipe: Recipe): Promise<boolean> {
  if (await ensureRecipesScene() == null) return false;

  const store = useEditorStore.getState();
  const existing = store.elements.find(el => recipeIdOf(el) === recipe.id);

  if (existing) {
    store.revealElement(existing.key);
    store.ensureElementVisible(existing.key);
    toast.info(`Таблица уже есть на сцене «${RECIPES_SCENE_NAME}»`, {
      description: "Чтобы пересобрать её под изменившийся манифест, удалите таблицу и покажите рецепт заново.",
    });
    return true;
  }

  const key = store.createRecipeTable(recipe);
  if (!key) return false;

  store.revealElement(key);
  store.ensureElementVisible(key);
  return true;
}
