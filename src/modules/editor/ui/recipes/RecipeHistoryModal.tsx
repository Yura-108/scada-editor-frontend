"use client";

import React, {useEffect, useState} from "react";
import {toast} from "sonner";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useEditorStore} from "../../model/editorStore";
import {useInvalidateRecipes} from "../../api/recipes";
import {Button} from "@/shared/ui/Button";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {VersionHistoryList} from "@/shared/ui/VersionHistoryList";
import {Banner} from "@/shared/ui/Banner";
import {Spinner} from "@/shared/ui/Spinner";
import {fetchVersions} from "@/core/project";
import {readBackendError} from "@/core/access";
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
  const closeModal = useCloseModal();
  const projectId = useEditorStore(s => s.currentProject?.id ?? null);
  const invalidateRecipes = useInvalidateRecipes();
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
      if (projectId != null) void invalidateRecipes(projectId);
      closeModal();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <DialogHeader
        title={<>История рецепта «{recipe.name}»</>}
        description="Каждое сохранение — версия. Восстановление создаёт новую версию из выбранной."
      />

      <DialogBody>
        {error ? (
          <Banner tone="destructive">{error}</Banner>
        ) : !versions ? (
          <Spinner label="Загрузка…" />
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
      </DialogBody>

      <DialogFooter>
        <Button onClick={closeModal}>Закрыть</Button>
      </DialogFooter>
    </>
  );
}

export function openRecipeHistoryModal(props: Props) {
  useModalStore.getState().openModal(<RecipeHistoryContent {...props} />, {size: "lg"});
}
