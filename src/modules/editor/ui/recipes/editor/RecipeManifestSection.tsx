import React from "react";
import {Tags, Trash2} from "lucide-react";
import {IconButton} from "@/shared/ui/IconButton";
import {RECIPE_VALUE_TYPES, type RecipeTag, type RecipeValueType} from "@/core/project";
import {Input} from "@/shared/ui/field/Input";
import {Select} from "@/shared/ui/field/Select";
import {sectionTitle} from "./styles";

/** Теги рецепта («манифест» в контракте) — теги, которые рецепт вправе записывать. */
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
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          onClick={onPickTags}
        >
          <Tags size={15} />
          Выбрать из базы каналов
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Тегов пока нет — шагам нечего будет записывать. Нажмите «Выбрать из базы каналов».
        </p>
      ) : (
        <div className="space-y-2">
          {/* Подписи колонок над карточками: подсказки в полях пропадают, как только поле
              заполнено, и по заполненной строке было не понять, где имя, а где путь (#11 п. 10). */}
          <div className="grid grid-cols-[1fr_1.4fr_9rem_1.75rem] gap-2 px-2 text-xs text-muted-foreground">
            <span>Имя — так на тег ссылаются шаги</span><span>Путь тега в базе каналов</span><span>Тип значения</span><span />
          </div>
          {tags.map((tag, index) => (
            <div
              key={`${tag.tag}-${index}`}
              className="grid grid-cols-[1fr_1.4fr_9rem_1.75rem] gap-2 items-center rounded-lg border border-border p-2"
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
                value={tag.value_type ?? ""}
                onValueChange={(v) => patchTag(index, {value_type: (v || undefined) as RecipeValueType | undefined})}
                options={[
                  {value: "", label: "Без проверки"},
                  ...RECIPE_VALUE_TYPES.map(t => ({value: t.value, label: t.label})),
                ]}
              />
              <IconButton icon={Trash2} label="Убрать тег" size="xs" variant="danger" onClick={() => removeTag(index)} />
              <label className="col-span-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">Описание</span>
                <Input
                  size="sm"
                  value={tag.description ?? ""}
                  placeholder="для оператора, необязательно"
                  onChange={(e) => patchTag(index, {description: e.target.value})}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
