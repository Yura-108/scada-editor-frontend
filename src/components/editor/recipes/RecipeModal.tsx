"use client";

import React, {useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {useModalStore} from "@/store/modalStore";
import {useRecipeStore} from "@/store/useRecipeStore";
import {ComponentPropertyDto} from "@/types/editorElement.type";
import {RecipeDto} from "@/types/recipe.types";
import {cn} from "@/lib/utils";

interface Props {
  componentId: number;
  rowBindings: ComponentPropertyDto[];
  recipe?: RecipeDto;
}

function RecipeModalContent({componentId, rowBindings, recipe}: Props) {
  const closeModal = useModalStore((s) => s.closeModal);
  const createRecipe = useRecipeStore((s) => s.createRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);

  // Модалка размонтируется/монтируется заново при каждом открытии (ModalRoot
  // рендерит content под key={openKey}), поэтому начальные значения useState
  // всегда актуальны — сбрасывать их эффектом не нужно.
  const [name, setName] = useState(recipe?.name ?? "");
  const [valueByRowName, setValueByRowName] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {};
    for (const v of recipe?.values ?? []) seeded[v.row_name] = v.value;
    return seeded;
  });
  const [isLoading, setIsLoading] = useState(false);

  const canConfirm = Boolean(name.trim()) && !isLoading;

  const inputClass = cn(
    "w-full rounded-xl border bg-white dark:bg-gray-900/80",
    "border-gray-300 dark:border-gray-700/80",
    "px-4 py-3 text-gray-900 dark:text-gray-100",
    "placeholder:text-gray-400 dark:placeholder:text-gray-600",
    "outline-hidden hover:border-gray-400 dark:hover:border-gray-600",
    "focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20",
    "transition-all shadow-sm"
  );

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsLoading(true);
    try {
      const payload = {
        name: name.trim(),
        type: "recipe",
        component_id: componentId,
        values: rowBindings.map((rb) => ({row_name: rb.name, value: valueByRowName[rb.name] ?? ""})),
      };
      if (recipe) {
        await updateRecipe(recipe.id, payload);
      } else {
        await createRecipe(payload);
      }
      closeModal();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(92vh-3rem)] sm:max-h-[calc(92vh-4rem)]">
      <div className="shrink-0 mb-4">
        <Dialog.Title className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">
          {recipe ? "Редактирование рецепта" : "Создание рецепта"}
        </Dialog.Title>
        <Dialog.Description className="text-gray-500 dark:text-gray-400 text-sm">
          Значения по каждому привязанному к тегу параметру компонента.
        </Dialog.Description>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
            Название рецепта
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Кефир"
            className={inputClass}
          />
        </div>

        {rowBindings.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
            У компонента нет ни одной строки (вкладка «Строки») — рецепту не с чем работать.
          </div>
        ) : (
          <div className="space-y-3">
            {rowBindings.map((rb) => (
              <div key={rb.name} className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">
                  {rb.name}{" "}
                  <span className="normal-case text-gray-400 dark:text-gray-600">
                    ({rb.tag_id ? `тег: ${rb.tag_id}` : "локальный параметр"})
                  </span>
                </label>
                <input
                  type="text"
                  value={valueByRowName[rb.name] ?? ""}
                  onChange={(e) => setValueByRowName({...valueByRowName, [rb.name]: e.target.value})}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 mt-6 pt-4 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-800/80">
        <button
          onClick={closeModal}
          className="px-5 py-2.5 rounded-lg font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="px-6 py-2.5 rounded-lg font-medium bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-400 disabled:to-gray-400 text-white shadow-lg shadow-indigo-500/30 disabled:shadow-none transition-all"
        >
          {isLoading ? "Сохранение..." : recipe ? "Сохранить" : "Создать рецепт"}
        </button>
      </div>
    </div>
  );
}

export default function openRecipeModal(props: Props) {
  const {openModal} = useModalStore.getState();
  openModal(<RecipeModalContent {...props} />);
}
