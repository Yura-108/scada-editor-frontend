import React, {type Dispatch, type SetStateAction} from "react";
import {ChevronDown, ChevronUp, Plus, Trash2} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {coerceActionValue} from "../../../lib/recipeValidation";
import type {RecipeStep, RecipeTag} from "@/core/project";
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
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          onClick={() => setSteps(prev => [...prev, emptyStep()])}
        >
          <Plus size={15} />
          Добавить шаг
        </button>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {index + 1}
              </span>
              <Input
                size="sm"
                value={step.name}
                placeholder="Название шага"
                onChange={(e) => patchStep(index, {name: e.target.value})}
              />
              <IconButton icon={ChevronUp} label="Выше" size="xs" disabled={index === 0} onClick={() => moveStep(index, -1)} />
              <IconButton icon={ChevronDown} label="Ниже" size="xs" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} />
              <IconButton icon={Trash2} label="Удалить шаг" size="xs" variant="danger" disabled={steps.length === 1}
                onClick={() => setSteps(prev => prev.filter((_, i) => i !== index))} />
            </div>

            {/* Действие */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Действие при входе в шаг
                </span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline disabled:opacity-40"
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
                <p className="text-xs text-muted-foreground italic">
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
              <span className="text-xs text-muted-foreground">
                Условие перехода (JavaScript; пусто — сразу после действия)
              </span>
              <Textarea
                className="font-mono text-xs"
                value={step.condition_script ?? ""}
                placeholder="return elapsedMs >= 2000;"
                onChange={(e) => patchStep(index, {condition_script: e.target.value})}
              />
              <p className="text-xs text-muted-foreground">
                Доступны <code>elapsedMs</code>, <code>confirmed</code>,{" "}
                <code>readProjectTag(&quot;путь.тега&quot;)</code>. Скрипт исполняет рантайм.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
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
              <span className="text-xs text-muted-foreground">
                процедуру не останавливает — только помечает шаг
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
