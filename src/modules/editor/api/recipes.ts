import {useCallback} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {readBackendError} from "@/lib/access/accessErrors"; // переедет в core/access (шаг 8)
import type {Recipe, RecipeCreatePayload} from "@/types/recipe.types";

/**
 * Процедурные рецепты ОТКРЫТОГО ПРОЕКТА в редакторе (черновик).
 *
 * Контракт `docs/contract/2026-10-19-recipes-in-project-contract.md`: рецепт принадлежит
 * проекту, смотреть — `view`/`edit`, менять — `edit`. До мойки он доезжает только с новым
 * prod-выпуском, поэтому монитор этот список НЕ читает — у него свой из runtime
 * (`useMonitorRecipes` в модуле monitor), ровно тот, что исполнит процедура.
 */
export const recipeKeys = {
  list: (projectId: number) => ["recipes", projectId] as const,
};

const recipesUrl = (projectId: number) => `/api/editor/projects/${projectId}/recipes`;
// id — слаг внутри проекта, бывает кириллическим
const recipeUrl = (projectId: number, id: string) =>
  `${recipesUrl(projectId)}/${encodeURIComponent(id)}`;

/**
 * Текст ошибки бэкенда. У 400-х рецепта `message` содержательный — перечисляет необъявленные
 * теги или несовпавший тип; 403 (`NO_PROJECT_ACCESS` / `NO_EDIT`) переводит `describeDenial`.
 */
const fail = async (res: Response): Promise<never> => {
  throw new Error(await readBackendError(res));
};

const report = (err: unknown, fallback: string) => {
  console.error(err);
  toast.error(err instanceof Error && err.message ? err.message : fallback);
};

const fetchRecipes = async (projectId: number): Promise<Recipe[]> => {
  try {
    const res = await fetch(recipesUrl(projectId));
    if (!res.ok) await fail(res);
    return await res.json();
  } catch (err) {
    report(err, "Ошибка загрузки рецептов");
    throw err;
  }
};

/**
 * Список рецептов проекта. Ключ — по проекту, поэтому список другого проекта не показывается
 * ни мгновения. В пределах открытой панели не перечитывается (`staleTime: Infinity`); ошибка —
 * конечное состояние, повтор только кнопкой «Повторить» (`refetch`): автоповтор на 5xx и
 * обрыве сети давал бы цикл запросов и тостов.
 *
 * `gcTime: 0` — как только панель закрыта или проект сменён, кэш выбрасывается, и при
 * возвращении список читается заново: правки коллег за это время не потеряются.
 */
export function useRecipes(projectId: number | null) {
  return useQuery({
    queryKey: recipeKeys.list(projectId ?? -1),
    queryFn: () => fetchRecipes(projectId as number),
    enabled: projectId != null,
    staleTime: Infinity,
    gcTime: 0,
  });
}

/**
 * Создание, правка и удаление рецепта в проекте `projectId`. Ошибку показывают тостом сами
 * и **не пробрасывают**: создание и правка возвращают `null`, чтобы форма не закрывалась, а
 * черновик шагов не сбрасывался. Список правится по ответу сервера, без перечитки.
 */
export function useRecipeMutations(projectId: number | null) {
  const queryClient = useQueryClient();

  const patchList = (pid: number, update: (list: Recipe[]) => Recipe[]) =>
    queryClient.setQueryData<Recipe[]>(recipeKeys.list(pid), list => (list ? update(list) : list));

  const create = useMutation({
    mutationFn: async ({pid, payload}: {pid: number; payload: RecipeCreatePayload}) => {
      const res = await fetch(recipesUrl(pid), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) await fail(res);
      return (await res.json()) as Recipe;
    },
    onSuccess: (created, {pid}) => {
      patchList(pid, list => [...list, created]);
      toast.success("Рецепт создан");
    },
    onError: err => report(err, "Ошибка создания рецепта"),
  });

  const update = useMutation({
    mutationFn: async ({pid, id, payload}: {pid: number; id: string; payload: RecipeCreatePayload}) => {
      const res = await fetch(recipeUrl(pid, id), {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) await fail(res);
      return (await res.json()) as Recipe;
    },
    onSuccess: (updated, {pid, id}) => {
      patchList(pid, list => list.map(r => (r.id === id ? updated : r)));
      toast.success("Рецепт сохранён");
    },
    onError: err => report(err, "Ошибка сохранения рецепта"),
  });

  const remove = useMutation({
    mutationFn: async ({pid, id}: {pid: number; id: string}) => {
      const res = await fetch(recipeUrl(pid, id), {method: "DELETE"});
      if (!res.ok) await fail(res);
    },
    onSuccess: (_, {pid, id}) => {
      patchList(pid, list => list.filter(r => r.id !== id));
      toast.success("Рецепт удалён");
    },
    onError: err => report(err, "Ошибка удаления рецепта"),
  });

  const {mutateAsync: createAsync} = create;
  const {mutateAsync: updateAsync} = update;
  const {mutateAsync: removeAsync} = remove;

  const createRecipe = useCallback(
    async (payload: RecipeCreatePayload): Promise<Recipe | null> =>
      projectId == null ? null : createAsync({pid: projectId, payload}).catch(() => null),
    [projectId, createAsync],
  );
  const updateRecipe = useCallback(
    async (id: string, payload: RecipeCreatePayload): Promise<Recipe | null> =>
      projectId == null ? null : updateAsync({pid: projectId, id, payload}).catch(() => null),
    [projectId, updateAsync],
  );
  const deleteRecipe = useCallback(
    async (id: string): Promise<void> => {
      if (projectId != null) await removeAsync({pid: projectId, id}).catch(() => undefined);
    },
    [projectId, removeAsync],
  );

  return {createRecipe, updateRecipe, deleteRecipe};
}

/** Перечитать список проекта — после восстановления версии из истории. */
export function useInvalidateRecipes() {
  const queryClient = useQueryClient();
  return useCallback(
    (projectId: number) => queryClient.invalidateQueries({queryKey: recipeKeys.list(projectId)}),
    [queryClient],
  );
}
