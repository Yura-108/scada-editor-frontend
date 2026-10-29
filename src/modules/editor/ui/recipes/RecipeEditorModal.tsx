"use client";

import React, {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {AlertTriangle} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useEditorStore} from "../../model/editorStore";
import {useRecipeMutations} from "../../api/recipes";
import {ChooseManifestTagsModal} from "./ChooseManifestTagsModal";
import {validateRecipe} from "../../lib/recipeValidation";
import {Button, ModalFooter} from "@/shared/ui/Button";
import type {Recipe, RecipeStep, RecipeTag} from "@/types/recipe.types";
import {inputClass, sectionTitle} from "./editor/styles";
import {RecipeManifestSection} from "./editor/RecipeManifestSection";
import {RecipePauseSection} from "./editor/RecipePauseSection";
import {emptyStep, RecipeStepsSection} from "./editor/RecipeStepsSection";

/**
 * Редактор процедурного рецепта: манифест тегов + упорядоченные шаги.
 *
 * Скрипт условия здесь — обычное текстовое поле: исполняет его рантайм, фронт не разбирает.
 */
interface Props {
  /** Не задан — создаём новый. */
  recipe?: Recipe;
}

function RecipeEditorContent({recipe}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const {createRecipe, updateRecipe} = useRecipeMutations(useEditorStore((s) => s.currentProject?.id ?? null));

  // Модалка пересоздаётся при каждом открытии (ModalRoot держит содержимое под key={contentKey}),
  // поэтому начальные значения всегда актуальны — сбрасывать их эффектом не нужно.
  const [name, setName] = useState(recipe?.name ?? "");
  const [tags, setTags] = useState<RecipeTag[]>(recipe?.tags ?? []);
  const [steps, setSteps] = useState<RecipeStep[]>(recipe?.steps ?? [emptyStep()]);
  /**
   * Безопасное состояние на паузе — поле рецепта, а не шага: оно одно на всю процедуру.
   * У нового рецепта пусто, и это допустимо — тогда пауза останавливает продвижение по
   * шагам, но ничего в ПЛК не пишет.
   */
  const [pauseAction, setPauseAction] = useState(recipe?.pause_action ?? []);
  const [isSaving, setIsSaving] = useState(false);
  // Выбор тегов — локальный Modal поверх этой формы. Через openModal нельзя: он открывает
  // окно вместо верхнего и подменил бы эту форму, потеряв всё набранное.
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const problems = validateRecipe({name, tags, steps, pause_action: pauseAction});

  const patchTag = (index: number, patch: Partial<RecipeTag>) =>
    setTags(prev => prev.map((t, i) => i === index ? {...t, ...patch} : t));

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
        // Шлём ВСЕГДА, в том числе пустым массивом: для бэкенда отсутствие поля означает
        // «оставить прежнее», и промолчав, форма не смогла бы очистить безопасное состояние.
        pause_action: pauseAction,
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

        <RecipeManifestSection
          tags={tags}
          patchTag={patchTag}
          removeTag={(index) => setTags(prev => prev.filter((_, i) => i !== index))}
          onPickTags={() => setTagPickerOpen(true)}
        />

        <RecipePauseSection tags={tags} pauseAction={pauseAction} setPauseAction={setPauseAction} />

        <RecipeStepsSection tags={tags} steps={steps} setSteps={setSteps} />
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
  openModal(<RecipeEditorContent {...props} />, {size: "fullscreen", legacyLayout: true});
}
