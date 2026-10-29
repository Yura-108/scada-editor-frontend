import React from "react";
import {Trash2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {shortTagPath} from "@/core/scene";
import {actionValueText, coerceActionValue} from "../../../lib/recipeValidation";
import type {RecipeStepAction, RecipeTag} from "@/types/recipe.types";
import {inputClass} from "./styles";

/**
 * Запись одного тега: тег из манифеста, значение, путь и «убрать». Одна и та же строка —
 * в действии шага и в безопасном состоянии паузы.
 */
export function TagWriteRow({action, tags, onChange, onRemove}: {
  action: RecipeStepAction;
  tags: RecipeTag[];
  onChange: (next: RecipeStepAction) => void;
  onRemove: () => void;
}) {
  const tag = tags.find(t => t.name === action.tag);
  return (
    <div className="flex items-center gap-2">
      {/* Тег выбирается ИЗ МАНИФЕСТА, а не вводится: бэкенд проверяет записи одним
          `checkAction`, и свободный ввод — главный источник 400 «tag not declared in manifest». */}
      <select
        className={cn(inputClass, "max-w-[45%]")}
        value={action.tag}
        onChange={(e) => {
          const picked = tags.find(t => t.name === e.target.value);
          onChange({tag: e.target.value, value: coerceActionValue(actionValueText(action.value), picked?.value_type)});
        }}
      >
        {tags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>
      <input
        className={inputClass}
        value={actionValueText(action.value)}
        placeholder={tag?.value_type === "bool" ? "true / false" : "значение"}
        onChange={(e) => onChange({...action, value: coerceActionValue(e.target.value, tag?.value_type)})}
      />
      <span className="text-xs text-gray-400 dark:text-gray-600 truncate max-w-[28%]" title={tag?.tag}>
        {tag ? shortTagPath(tag.tag) : "тег не найден"}
      </span>
      <button type="button" className="p-1 text-red-600 dark:text-red-400 hover:text-red-500"
              title="Убрать запись"
              onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
