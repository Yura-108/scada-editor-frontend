"use client";

import React, {useState} from "react";
import {AlertTriangle} from "lucide-react";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useEditorStore} from "../../model/editorStore";
import {useRecipeMutations} from "../../api/recipes";
import {pickTags, useDeviceTreeStore} from "@/core/devices";
import {buildManifestTags} from "../../lib/tagMeta";
import {validateRecipe} from "../../lib/recipeValidation";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import type {Recipe, RecipeStep, RecipeTag} from "@/types/recipe.types";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
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
  const closeModal = useCloseModal();
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

  const problems = validateRecipe({name, tags, steps, pause_action: pauseAction});

  // Выбор тегов открывается ПОВЕРХ этой формы (pickTags → pushModal): форма остаётся со всем
  // набранным. Строки манифеста — короткое имя, путь, тип и описание из базы каналов.
  const addManifestTags = async () => {
    const picked = await pickTags({
      title: "Теги рецепта",
      description: "Отметьте теги, которые рецепт вправе записывать. На них будут ссылаться действия шагов — по короткому имени, а не по пути.",
      note: <>
        Тип значения подставляется из базы каналов, но <b>логический тег она отличить не
        умеет</b> — там есть только признак «строковый». Дискретные теги пометьте вручную
        в списке манифеста, иначе запись <code>true</code> не пройдёт проверку.
      </>,
    });
    if (!picked) return;
    const params = useDeviceTreeStore.getState().params;
    setTags(prev => [...prev, ...buildManifestTags(picked, params, prev.map(t => t.name))]);
  };

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
    <>
      <DialogHeader
        title={recipe ? "Редактирование рецепта" : "Новый рецепт"}
        description="Манифест перечисляет теги, которые рецепт вправе записывать; шаги выполняются по порядку — действие при входе, затем условие перехода к следующему."
      />

      <DialogBody className="space-y-6">
        <Field
          label="Название"
          hint={recipe && <>Идентификатор <code>{recipe.id}</code> при переименовании не меняется.</>}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Мойка щёлочью, линия 1" />
        </Field>

        <RecipeManifestSection
          tags={tags}
          patchTag={patchTag}
          removeTag={(index) => setTags(prev => prev.filter((_, i) => i !== index))}
          onPickTags={() => void addManifestTags()}
        />

        <RecipePauseSection tags={tags} pauseAction={pauseAction} setPauseAction={setPauseAction} />

        <RecipeStepsSection tags={tags} steps={steps} setSteps={setSteps} />
      </DialogBody>

      {problems.length > 0 && (
        <Banner tone="warning" icon={AlertTriangle} title="Рецепт пока нельзя сохранить" className="shrink-0 mx-6 my-4">
          <ul className="list-disc pl-5 space-y-0.5">
            {problems.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
            {problems.length > 5 && <li>…и ещё {problems.length - 5}</li>}
          </ul>
        </Banner>
      )}

      <DialogFooter>
        <Button onClick={closeModal} disabled={isSaving}>Отмена</Button>
        <Button variant="primary" onClick={handleSave} disabled={isSaving || problems.length > 0}>
          {isSaving ? "Сохранение..." : recipe ? "Сохранить" : "Создать"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function openRecipeEditorModal(props: Props = {}) {
  const {openModal} = useModalStore.getState();
  openModal(<RecipeEditorContent {...props} />, {size: "fullscreen", closeOnOverlay: false});
}
