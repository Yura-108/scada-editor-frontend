import React from "react";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import type {RecipeValueType} from "@/types/recipe.types";

const BOOL_OPTIONS = [
  {value: "", label: "не пишется"},
  {value: "true", label: "true"},
  {value: "false", label: "false"},
];

/**
 * Значение тега в шаге рецепта (таблица панели рецептов): для логического тега — выбор
 * true/false, для остальных — строка. Пусто — тег в этом шаге не пишется.
 */
export function RecipeValueCell({valueType, text, onChange}: {
  valueType: RecipeValueType | undefined;
  text: string;
  onChange: (text: string) => void;
}) {
  return valueType === "bool" ? (
    <Select size="sm" value={text} onValueChange={onChange} options={BOOL_OPTIONS} />
  ) : (
    <Input size="sm" value={text} placeholder="не пишется" onChange={(e) => onChange(e.target.value)} />
  );
}
