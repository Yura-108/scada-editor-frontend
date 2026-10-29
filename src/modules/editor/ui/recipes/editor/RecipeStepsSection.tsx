import React, {type Dispatch, type SetStateAction} from "react";
import {ChevronDown, ChevronUp, Plus, Trash2} from "lucide-react";
import {coerceActionValue} from "../../../lib/recipeValidation";
import type {RecipeStep, RecipeTag} from "@/types/recipe.types";
import {Input} from "@/shared/ui/field/Input";
import {Textarea} from "@/shared/ui/field/Textarea";
import {sectionTitle} from "./styles";
import {TagWriteRow} from "./TagWriteRow";

export const emptyStep = (): RecipeStep => ({
  name: "",
  action: [],
  condition_script: null,
  timeout_ms: null,
});

/** Шаги рецепта по порядку: действие при входе, условие перехода, таймаут «зависания». */
export function RecipeStepsSection({tags, steps, setSteps}: {
  tags: RecipeTag[];
  steps: RecipeStep[];
  setSteps: Dispatch<SetStateAction<RecipeStep[]>>;
}) {
  const patchStep = (index: number, patch: Partial<RecipeStep>) =>
    setSteps(prev => prev.map((s, i) => i === index ? {...s, ...patch} : s));

  const moveStep = (index: number, delta: number) => setSteps(prev => {
    const target = index + delta;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={sectionTitle}>Шаги ({steps.length})</span>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => setSteps(prev => [...prev, emptyStep()])}
        >
          <Plus size={15} />
          Добавить шаг
        </button>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300">
                {index + 1}
              </span>
              <Input
                size="sm"
                value={step.name}
                placeholder="Название шага"
                onChange={(e) => patchStep(index, {name: e.target.value})}
              />
              <button type="button" className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30"
                      disabled={index === 0} title="Выше" onClick={() => moveStep(index, -1)}>
                <ChevronUp size={16} />
              </button>
              <button type="button" className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30"
                      disabled={index === steps.length - 1} title="Ниже" onClick={() => moveStep(index, 1)}>
                <ChevronDown size={16} />
              </button>
              <button type="button" className="p-1 text-red-600 dark:text-red-400 hover:text-red-500 disabled:opacity-30"
                      disabled={steps.length === 1} title="Удалить шаг"
                      onClick={() => setSteps(prev => prev.filter((_, i) => i !== index))}>
                <Trash2 size={16} />
              </button>
            </div>

            {/* Действие */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Действие при входе в шаг
                </span>
                <button
                  type="button"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                  disabled={tags.length === 0}
                  title={tags.length === 0 ? "Сначала добавьте теги в манифест" : undefined}
                  onClick={() => patchStep(index, {
                    action: [...step.action, {tag: tags[0].name, value: coerceActionValue("", tags[0].value_type)}],
                  })}
                >
                  + запись тега
                </button>
              </div>

              {step.action.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic">
                  Без записи — например, шаг ожидания подтверждения.
                </p>
              ) : step.action.map((action, ai) => (
                <TagWriteRow
                  key={ai}
                  action={action}
                  tags={tags}
                  onChange={(next) => patchStep(index, {action: step.action.map((a, i) => i === ai ? next : a)})}
                  onRemove={() => patchStep(index, {action: step.action.filter((_, i) => i !== ai)})}
                />
              ))}
            </div>

            {/* Условие перехода */}
            <div className="space-y-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Условие перехода (JavaScript; пусто — сразу после действия)
              </span>
              <Textarea
                className="font-mono text-xs"
                value={step.condition_script ?? ""}
                placeholder="return elapsedMs >= 2000;"
                onChange={(e) => patchStep(index, {condition_script: e.target.value})}
              />
              <p className="text-xs text-gray-400 dark:text-gray-600">
                Доступны <code>elapsedMs</code>, <code>confirmed</code>,{" "}
                <code>readProjectTag(&quot;путь.тега&quot;)</code>. Скрипт исполняет рантайм.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                Таймаут «зависания», мс
              </span>
              <Input
                size="sm"
                type="number"
                min={1}
                className="max-w-40"
                value={step.timeout_ms ?? ""}
                placeholder="не задан"
                onChange={(e) => patchStep(index, {
                  timeout_ms: e.target.value === "" ? null : Number(e.target.value),
                })}
              />
              <span className="text-xs text-gray-400 dark:text-gray-600">
                процедуру не останавливает — только помечает шаг
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
