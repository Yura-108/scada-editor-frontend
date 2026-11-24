import {useState} from "react";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {useModalCloseGuard} from "@/shared/ui/dialog/closeGuard";
import type {Recipe, RecipeCreatePayload} from "@/core/project";

type FormState = Pick<RecipeCreatePayload, "name" | "tags" | "steps" | "pause_action">;

/** Снимок формы для сравнения: то же, с чего форма начинает (`RecipeEditorModal`). */
function snapshot(form: FormState): string {
  return JSON.stringify([form.name, form.tags ?? [], form.steps ?? [], form.pause_action ?? []]);
}

/**
 * Окно рецепта не закрывается молча, пока в форме есть правки (#11 п. 7): крестик, Esc и
 * «Отмена» спрашивают «Закрыть без сохранения?». Без правок закрывается сразу. Сохранение
 * закрывает окно без вопроса — оно идёт мимо охраны (`useCloseModal`).
 */
export function useRecipeCloseGuard(recipe: Recipe | undefined, form: FormState): void {
  // Снимок первого рендера — это и есть исходное: форма начинает с рецепта (или с пустого
  // нового с одним пустым шагом), и каждое открытие окна монтирует её заново.
  const [initial] = useState(() => snapshot(form));
  const dirty = snapshot(form) !== initial;

  useModalCloseGuard(() => !dirty || confirmModal({
    title: "Закрыть без сохранения?",
    description: recipe
      ? `Правки рецепта «${recipe.name}» пропадут.`
      : "Введённое в форме нового рецепта пропадёт.",
    confirmLabel: "Закрыть без сохранения",
    cancelLabel: "Остаться",
    danger: true,
  }));
}
