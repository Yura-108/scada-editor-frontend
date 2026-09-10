import type {RecipeStep, RecipeTag} from "@/types/recipe.types";
import {actionValueText, coerceActionValue} from "@/lib/editor/recipeValidation";

/**
 * Правка значений тегов внутри шага.
 *
 * В контракте у тега нет собственного значения: значение принадлежит ДЕЙСТВИЮ шага
 * (`steps[].action[]`). Поэтому «задать значение тегу» всегда означает «задать его
 * в конкретном шаге», а отсутствие записи в `action` — это «в этом шаге тег не пишется».
 *
 * Модуль чистый: ни React, ни стора — проверяется headless.
 */

/** Текст в поле ввода: значение тега в шаге или пусто, если шаг его не пишет. */
export function stepValueText(step: RecipeStep, tagName: string): string {
  const action = step.action?.find(a => a.tag === tagName);
  return action ? actionValueText(action.value) : "";
}

/** Пишет ли шаг этот тег. */
export const stepWritesTag = (step: RecipeStep, tagName: string): boolean =>
  (step.action ?? []).some(a => a.tag === tagName);

/**
 * Новый шаг с изменённым значением тега.
 *
 * Пустой текст УБИРАЕТ запись из `action`: «пусто» и «записать пустую строку» — разные
 * намерения, и первое встречается несравнимо чаще. Записать пустую строку в строковый тег
 * по-прежнему можно — через редактор рецепта, где действия задаются явным списком.
 *
 * Порядок существующих записей сохраняется: новая добавляется в конец, изменённая
 * правится на месте — иначе перестановка полей выглядела бы как правка процедуры.
 */
export function setStepValue(
  step: RecipeStep,
  tag: RecipeTag,
  text: string,
): RecipeStep {
  const action = step.action ?? [];

  if (!text.trim()) {
    if (!stepWritesTag(step, tag.name)) return step;
    return {...step, action: action.filter(a => a.tag !== tag.name)};
  }

  const value = coerceActionValue(text, tag.value_type);

  return stepWritesTag(step, tag.name)
    ? {...step, action: action.map(a => a.tag === tag.name ? {...a, value} : a)}
    : {...step, action: [...action, {tag: tag.name, value}]};
}

/** Тот же шаг в списке — с изменённым значением тега. */
export const setStepValueAt = (
  steps: RecipeStep[],
  stepIndex: number,
  tag: RecipeTag,
  text: string,
): RecipeStep[] =>
  steps.map((s, i) => i === stepIndex ? setStepValue(s, tag, text) : s);

/** Отличаются ли шаги от исходных — по значению, а не по ссылке. */
export const stepsChanged = (a: RecipeStep[], b: RecipeStep[]): boolean =>
  JSON.stringify(a) !== JSON.stringify(b);
