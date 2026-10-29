import React, {type Dispatch, type SetStateAction} from "react";
import {coerceActionValue} from "../../../lib/recipeValidation";
import type {RecipeStepAction, RecipeTag} from "@/types/recipe.types";
import {sectionTitle} from "./styles";
import {TagWriteRow} from "./TagWriteRow";

/**
 * Безопасное состояние на паузе — поле рецепта, а не шага: оно одно на всю процедуру.
 * Пусто — допустимо: пауза остановит продвижение по шагам, но ничего в ПЛК не запишет.
 */
export function RecipePauseSection({tags, pauseAction, setPauseAction}: {
  tags: RecipeTag[];
  pauseAction: RecipeStepAction[];
  setPauseAction: Dispatch<SetStateAction<RecipeStepAction[]>>;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={sectionTitle}>Безопасное состояние на паузе ({pauseAction.length})</span>
        <button
          type="button"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
          disabled={tags.length === 0}
          title={tags.length === 0 ? "Сначала добавьте теги в манифест" : undefined}
          onClick={() => setPauseAction(prev => [
            ...prev,
            {tag: tags[0].name, value: coerceActionValue("", tags[0].value_type)},
          ])}
        >
          + запись тега
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Что записать, когда процедура встаёт на паузу — вручную или сама по аварии.
        Обычно это остановка подачи и нагрева; клапаны сюда не включают, чтобы пауза не
        сливала контур. При снятии паузы к значениям текущего шага вернутся <b>только</b>
        {" "}перечисленные здесь теги — остальное шаг не переприменяет.
      </p>

      {pauseAction.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600 italic">
          Пусто — пауза остановит продвижение по шагам, но ничего в ПЛК не запишет.
        </p>
      ) : pauseAction.map((action, ai) => (
        <TagWriteRow
          key={ai}
          action={action}
          tags={tags}
          onChange={(next) => setPauseAction(prev => prev.map((a, i) => i === ai ? next : a))}
          onRemove={() => setPauseAction(prev => prev.filter((_, i) => i !== ai))}
        />
      ))}
    </section>
  );
}
