"use client";

import React, {useEffect, useState} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {toast} from "sonner";
import {useModalStore} from "@/store/modalStore";
import {useRecipeStore} from "@/store/useRecipeStore";
import {Button, ModalFooter} from "@/components/ui/Button";
import {VersionHistoryList} from "@/components/automation/VersionHistoryList";
import {fetchVersions} from "@/lib/editor/versionsApi";
import {readBackendError} from "@/lib/access/accessErrors";
import type {VersionSummary} from "@/types/editorVersion.types";
import type {Recipe} from "@/types/recipe.types";

/**
 * История версий рецепта — по `document_id`, тем же общим контроллером версий, что у сцен
 * (`docs/contract/2026-10-19-recipes-in-project-contract.md`).
 *
 * Восстановление дописывает историю новой версией и меняет только ЧЕРНОВИК: до мойки рецепт
 * доезжает с выпуском, как после обычного сохранения.
 */
interface Props {
  recipe: Recipe;
  documentId: number;
  /** Нет права правки — только просмотр списка. */
  editable: boolean;
  /** Несохранённые значения шагов в панели — восстановление их молча затёрло бы. */
  dirty: boolean;
}

function RecipeHistoryContent({recipe, documentId, editable, dirty}: Props) {
  const closeModal = useModalStore(s => s.closeModal);
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVersions("recipes", documentId)
      .then(list => !cancelled && setVersions(list))
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : "Не удалось загрузить историю"));
    return () => { cancelled = true; };
  }, [documentId]);

  const restore = async (versionNo: number) => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/editor/history/recipes/${documentId}/restore/${versionNo}`, {method: "POST"});
      if (!res.ok) {
        toast.error(await readBackendError(res));
        return;
      }
      toast.success(`Рецепт «${recipe.name}» восстановлен из v${versionNo}. До мойки он дойдёт с новым выпуском`);
      // Ответ восстановления — документ, а не `Recipe`: проще и надёжнее перечитать список.
      const {projectId, loadRecipes} = useRecipeStore.getState();
      if (projectId != null) void loadRecipes(projectId);
      closeModal();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <Dialog.Title className="text-xl font-semibold mb-1">История рецепта «{recipe.name}»</Dialog.Title>
      <Dialog.Description className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
        Каждое сохранение — версия. Восстановление создаёт новую версию из выбранной.
      </Dialog.Description>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !versions ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar -mx-4">
          <VersionHistoryList
            versions={versions}
            // Свежая версия первой — она и есть текущий черновик.
            currentVersion={versions[0]?.version_no ?? null}
            dirty={dirty || restoring}
            onRestore={editable ? v => void restore(v) : undefined}
          />
        </div>
      )}

      {dirty && editable && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          В панели есть несохранённые значения шагов — сохраните или сбросьте их перед восстановлением.
        </p>
      )}

      <ModalFooter>
        <Button onClick={closeModal}>Закрыть</Button>
      </ModalFooter>
    </div>
  );
}

export function openRecipeHistoryModal(props: Props) {
  useModalStore.getState().openModal(<RecipeHistoryContent {...props} />);
}
