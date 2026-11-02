"use client";

import React from "react";
import {ChevronDown, ChevronRight, History, ListOrdered, Pencil, Tags, Trash2} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import {IconButton} from "@/shared/ui/IconButton";
import type {Recipe} from "@/core/project";
import openRecipeEditorModal from "./RecipeEditorModal";
import {openRecipeHistoryModal} from "./RecipeHistoryModal";

/** Строка рецепта: раскрытие по клику, «не сохранено», число тегов и шагов, история, правка, удаление. */
export function RecipeRow({recipe, isOpen, dirty, stepCount, canEditRecipes, toggle, handleDelete}: {
  recipe: Recipe;
  isOpen: boolean;
  dirty: boolean;
  stepCount: number;
  canEditRecipes: boolean;
  toggle: (recipe: Recipe) => void;
  handleDelete: (recipe: Recipe) => Promise<void>;
}) {
  const tags = recipe.tags ?? [];
  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
      onClick={() => toggle(recipe)}
    >
      <td className="pl-4 text-gray-400">
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </td>
      <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">
        {recipe.name}
        {dirty && (
          <Badge tone="warning" className="ml-2 font-normal">не сохранено</Badge>
        )}
        <div className="text-xs font-normal text-gray-400 dark:text-gray-600">{recipe.id}</div>
      </td>
      <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5"><Tags size={14} />{tags.length}</span>
      </td>
      <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5"><ListOrdered size={14} />{stepCount}</span>
      </td>
      {/* Клик по кнопкам не должен заодно сворачивать строку. */}
      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-3">
          {/* История доступна и на чтение: смотреть версии может и `view`. */}
          {recipe.document_id != null && (
            <IconButton
              icon={History}
              label="История версий"
              onClick={() => openRecipeHistoryModal({
                recipe,
                documentId: recipe.document_id!,
                editable: canEditRecipes,
                dirty,
              })}
            />
          )}
          {canEditRecipes && <IconButton icon={Pencil} label="Редактировать" onClick={() => openRecipeEditorModal({recipe})} />}
          {canEditRecipes && <IconButton icon={Trash2} label="Удалить рецепт" title="Удалить" variant="danger" onClick={() => void handleDelete(recipe)} />}
        </div>
      </td>
    </tr>
  );
}
