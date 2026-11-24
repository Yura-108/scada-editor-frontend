import React from "react";
import {Select} from "@/shared/ui/field/Select";

/**
 * За какой процедурой следить — список рецептов проекта (HUD монитора и панель процедур).
 * Пусто — процедура не выбрана.
 */
export function ProcedureRecipeSelect({recipes, recipeId, onWatch, placeholder, disabled, className}: {
  recipes: {id: string; name: string}[];
  recipeId: string | null;
  onWatch: (recipeId: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      size="sm"
      className={className}
      value={recipeId ?? ""}
      disabled={disabled}
      onValueChange={(v) => onWatch(v || null)}
      placeholder={placeholder}
      options={recipes.map(r => ({value: r.id, label: r.name}))}
    />
  );
}
