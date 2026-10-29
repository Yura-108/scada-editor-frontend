import React from "react";
import {Tags, Trash2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {RECIPE_VALUE_TYPES, type RecipeTag, type RecipeValueType} from "@/types/recipe.types";
import {inputClass, sectionTitle} from "./styles";

/** Манифест рецепта — теги, которые рецепт вправе записывать. */
export function RecipeManifestSection({tags, patchTag, removeTag, onPickTags}: {
  tags: RecipeTag[];
  patchTag: (index: number, patch: Partial<RecipeTag>) => void;
  removeTag: (index: number) => void;
  onPickTags: () => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={sectionTitle}>Теги ({tags.length})</span>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={onPickTags}
        >
          <Tags size={15} />
          Выбрать из базы каналов
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Манифест пуст — шагам будет нечего записывать.
        </p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag, index) => (
            <div
              key={`${tag.tag}-${index}`}
              className="grid grid-cols-[1fr_1.4fr_auto_auto] gap-2 items-center rounded-lg border border-gray-200 dark:border-gray-800 p-2"
            >
              <input
                className={inputClass}
                value={tag.name}
                placeholder="Имя"
                onChange={(e) => patchTag(index, {name: e.target.value})}
              />
              <input
                className={inputClass}
                value={tag.tag}
                placeholder="Путь тега"
                title={tag.tag}
                onChange={(e) => patchTag(index, {tag: e.target.value})}
              />
              <select
                className={inputClass}
                value={tag.value_type ?? ""}
                onChange={(e) => patchTag(index, {
                  value_type: (e.target.value || undefined) as RecipeValueType | undefined,
                })}
              >
                <option value="">Без проверки</option>
                {RECIPE_VALUE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="text-red-600 dark:text-red-400 hover:text-red-500 px-1"
                title="Убрать тег"
                onClick={() => removeTag(index)}
              >
                <Trash2 size={16} />
              </button>
              <input
                className={cn(inputClass, "col-span-4")}
                value={tag.description ?? ""}
                placeholder="Описание (для интерфейса)"
                onChange={(e) => patchTag(index, {description: e.target.value})}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
