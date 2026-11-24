import React from "react";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import type {RecipeValueType} from "@/core/project";
import {valueTextProblem} from "../../lib/recipeValidation";

const BOOL_OPTIONS = [
  {value: "", label: "не пишется"},
  {value: "true", label: "true"},
  {value: "false", label: "false"},
];

/**
 * Значение тега в шаге рецепта (таблица панели рецептов): для логического тега — выбор
 * true/false, для остальных — строка. Пусто — тег в этом шаге не пишется. Значение не по типу
 * подсвечивается сразу, при вводе, а не всплывающей ошибкой после «Сохранить» (#11 п. 8).
 */
export function RecipeValueCell({valueType, text, onChange}: {
  valueType: RecipeValueType | undefined;
  text: string;
  onChange: (text: string) => void;
}) {
  if (valueType === "bool") return <Select size="sm" value={text} onValueChange={onChange} options={BOOL_OPTIONS} />;
  const problem = valueTextProblem(text, valueType);
  return (
    <div className="space-y-1">
      <Input size="sm" value={text} placeholder="не пишется" aria-invalid={problem ? true : undefined}
        onChange={(e) => onChange(e.target.value)} />
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}
