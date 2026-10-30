import React from "react";
import {Tags, Trash2} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {RECIPE_VALUE_TYPES, type RecipeTag, type RecipeValueType} from "@/types/recipe.types";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {sectionTitle} from "./styles";

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
              <Input
                size="sm"
                value={tag.name}
                placeholder="Имя"
                onChange={(e) => patchTag(index, {name: e.target.value})}
              />
              <Input
                size="sm"
                value={tag.tag}
                placeholder="Путь тега"
                title={tag.tag}
                onChange={(e) => patchTag(index, {tag: e.target.value})}
              />
              <Select
                size="sm"
                className="w-36"
                value={tag.value_type ?? ""}
                onValueChange={(v) => patchTag(index, {value_type: (v || undefined) as RecipeValueType | undefined})}
                options={[
                  {value: "", label: "Без проверки"},
                  ...RECIPE_VALUE_TYPES.map(t => ({value: t.value, label: t.label})),
                ]}
              />
              <IconButton icon={Trash2} label="Убрать тег" size="xs" variant="danger" onClick={() => removeTag(index)} />
              <Input
                size="sm"
                className="col-span-4"
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
