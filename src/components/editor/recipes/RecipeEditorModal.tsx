"use client";

import React, {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertTriangle, ChevronDown, ChevronUp, Plus, Tags, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {useModalStore} from "@/store/modalStore";
import {useRecipeStore} from "@/store/useRecipeStore";
import {ChooseManifestTagsModal} from "@/components/editor/recipes/ChooseManifestTagsModal";
import {actionValueText, coerceActionValue, validateRecipe} from "@/lib/editor/recipeValidation";
import {shortTagPath} from "@/lib/editor/tagPath";
import {Button, ModalFooter} from "@/components/ui/Button";
import {
  RECIPE_VALUE_TYPES,
  type Recipe,
  type RecipeStep,
  type RecipeTag,
  type RecipeValueType,
} from "@/types/recipe.types";

/**
 * Редактор процедурного рецепта: манифест тегов + упорядоченные шаги.
 *
 * Скрипт условия здесь — обычное текстовое поле: исполняет его рантайм, фронт не разбирает.
 */
interface Props {
  /** Не задан — создаём новый. */
  recipe?: Recipe;
}

const emptyStep = (): RecipeStep => ({
  name: "",
  action: [],
  condition_script: null,
  timeout_ms: null,
});

const inputClass = cn(
  "w-full rounded-lg border bg-white dark:bg-gray-900/80",
  "border-gray-300 dark:border-gray-700/80",
  "px-3 py-2 text-sm text-gray-900 dark:text-gray-100",
  "placeholder:text-gray-400 dark:placeholder:text-gray-600",
  "outline-hidden hover:border-gray-400 dark:hover:border-gray-600",
  "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all",
);

const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

function RecipeEditorContent({recipe}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const createRecipe = useRecipeStore((s) => s.createRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);

  // Модалка пересоздаётся при каждом открытии (ModalRoot держит content под key={openKey}),
  // поэтому начальные значения всегда актуальны — сбрасывать их эффектом не нужно.
  const [name, setName] = useState(recipe?.name ?? "");
  const [tags, setTags] = useState<RecipeTag[]>(recipe?.tags ?? []);
  const [steps, setSteps] = useState<RecipeStep[]>(recipe?.steps ?? [emptyStep()]);
  const [isSaving, setIsSaving] = useState(false);
  // Выбор тегов — ВЛОЖЕННЫЙ диалог, который рисуем сами. Через useModalStore нельзя:
  // он одноместный и подменил бы эту форму, потеряв всё набранное.
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const problems = validateRecipe({name, tags, steps});

  const patchTag = (index: number, patch: Partial<RecipeTag>) =>
    setTags(prev => prev.map((t, i) => i === index ? {...t, ...patch} : t));

  const patchStep = (index: number, patch: Partial<RecipeStep>) =>
    setSteps(prev => prev.map((s, i) => i === index ? {...s, ...patch} : s));

  const moveStep = (index: number, delta: number) => setSteps(prev => {
    const target = index + delta;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const handleSave = async () => {
    if (problems.length) return;
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        tags: tags.map(t => ({
          name: t.name.trim(),
          tag: t.tag.trim(),
          value_type: t.value_type,
          description: t.description?.trim() || undefined,
        })),
        steps: steps.map(s => ({
          name: s.name.trim(),
          action: s.action,
          // Пустая строка и null для бэкенда одно и то же — «условия нет»;
          // шлём null, чтобы в файле не копился мусор.
          condition_script: s.condition_script?.trim() ? s.condition_script : null,
          timeout_ms: s.timeout_ms,
        })),
      };

      const saved = recipe
        ? await updateRecipe(recipe.id, payload)
        : await createRecipe(payload);
      if (saved) closeModal();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          {recipe ? "Редактирование рецепта" : "Новый рецепт"}
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Манифест перечисляет теги, которые рецепт вправе записывать; шаги выполняются
          по порядку — действие при входе, затем условие перехода к следующему.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6">
        <div className="space-y-2">
          <label className={sectionTitle}>Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Мойка щёлочью, линия 1"
            className={inputClass}
          />
          {recipe && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Идентификатор <code>{recipe.id}</code> при переименовании не меняется.
            </p>
          )}
        </div>

        {/* ─── Манифест ─── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className={sectionTitle}>Теги ({tags.length})</span>
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => setTagPickerOpen(true)}
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
                    onClick={() => setTags(prev => prev.filter((_, i) => i !== index))}
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

        {/* ─── Шаги ─── */}
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
                  <input
                    className={inputClass}
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
                  ) : step.action.map((action, ai) => {
                    const tag = tags.find(t => t.name === action.tag);
                    return (
                      <div key={ai} className="flex items-center gap-2">
                        {/* Тег выбирается ИЗ МАНИФЕСТА, а не вводится: свободный ввод —
                            главный источник 400 «tag not declared in manifest». */}
                        <select
                          className={cn(inputClass, "max-w-[45%]")}
                          value={action.tag}
                          onChange={(e) => {
                            const picked = tags.find(t => t.name === e.target.value);
                            patchStep(index, {
                              action: step.action.map((a, i) => i === ai
                                ? {tag: e.target.value, value: coerceActionValue(actionValueText(a.value), picked?.value_type)}
                                : a),
                            });
                          }}
                        >
                          {tags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                        </select>
                        <input
                          className={inputClass}
                          value={actionValueText(action.value)}
                          placeholder={tag?.value_type === "bool" ? "true / false" : "значение"}
                          onChange={(e) => patchStep(index, {
                            action: step.action.map((a, i) => i === ai
                              ? {...a, value: coerceActionValue(e.target.value, tag?.value_type)}
                              : a),
                          })}
                        />
                        <span className="text-xs text-gray-400 dark:text-gray-600 truncate max-w-[28%]" title={tag?.tag}>
                          {tag ? shortTagPath(tag.tag) : "тег не найден"}
                        </span>
                        <button type="button" className="p-1 text-red-600 dark:text-red-400 hover:text-red-500"
                                title="Убрать запись"
                                onClick={() => patchStep(index, {action: step.action.filter((_, i) => i !== ai)})}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Условие перехода */}
                <div className="space-y-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Условие перехода (JavaScript; пусто — сразу после действия)
                  </span>
                  <textarea
                    className={cn(inputClass, "font-mono text-xs min-h-20 resize-y")}
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
                  <input
                    type="number"
                    min={1}
                    className={cn(inputClass, "max-w-40")}
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
      </div>

      {problems.length > 0 && (
        <div className="shrink-0 mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle size={14} />
            Рецепт пока нельзя сохранить
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {problems.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
            {problems.length > 5 && <li>…и ещё {problems.length - 5}</li>}
          </ul>
        </div>
      )}

      <ChooseManifestTagsModal
        open={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        takenNames={tags.map(t => t.name)}
        onPick={(picked) => setTags(prev => [...prev, ...picked])}
      />

      <ModalFooter className="shrink-0 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800/80">
        <Button onClick={closeModal} disabled={isSaving}>Отмена</Button>
        <Button variant="primary" onClick={handleSave} disabled={isSaving || problems.length > 0}>
          {isSaving ? "Сохранение..." : recipe ? "Сохранить" : "Создать"}
        </Button>
      </ModalFooter>
    </div>
  );
}

export default function openRecipeEditorModal(props: Props = {}) {
  const {openModal} = useModalStore.getState();
  openModal(<RecipeEditorContent {...props} />, {variant: "fullscreen"});
}
