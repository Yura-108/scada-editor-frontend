import {useQuery} from "@tanstack/react-query";
import {EMPTY_PROCEDURE_LEVELS, type ProcedureLevels} from "@/types/access.types";
import type {Recipe} from "@/types/recipe.types";
// переедут в core/access вместе с правами (шаг 8)
import {parseProcedureLevels, readBackendError} from "@/core/access";

/**
 * Данные процедур из prod-выпуска проекта. В ключе — номер выпуска: другой проект или новый
 * выпуск (TREE_CHANGED меняет `releaseVersionNo`) — другие уровни и другой список, и Query
 * перечитывает их сам. `gcTime: 0` — после выхода из монитора кэш выбрасывается, при
 * возвращении всё читается заново.
 *
 * Хуки зовут несколько мест сразу (HUD, панель «Процедуры», кнопки) — запрос на ключ один.
 */
export const procedureKeys = {
  levels: (projectId: number | null, releaseVersionNo: number | null) =>
    ["monitor", "procedure-levels", projectId, releaseVersionNo] as const,
  recipes: (projectId: number | null, releaseVersionNo: number | null) =>
    ["monitor", "recipes", projectId, releaseVersionNo] as const,
};

/**
 * Уровни операций процедур (`GET /api/runtime/projects/{id}/procedure-levels`): по ним сервер
 * проверяет кнопки процедур, по ним же монитор гасит их заранее.
 *
 * Не загрузились (проект не в эксплуатации, старый бэкенд) — уровни считаются пустыми, то
 * есть 1: кнопки активны, и при нехватке уровня сервер ответит 403 с нужным уровнем. Пока
 * идёт загрузка — тоже пустые. Состояния ошибки у этого запроса нет.
 */
export function useProcedureLevels(projectId: number | null, releaseVersionNo: number | null): ProcedureLevels {
  const query = useQuery({
    queryKey: procedureKeys.levels(projectId, releaseVersionNo),
    queryFn: async (): Promise<ProcedureLevels> => {
      try {
        const res = await fetch(`/api/runtime/projects/${projectId}/procedure-levels`);
        if (!res.ok) return EMPTY_PROCEDURE_LEVELS;
        return parseProcedureLevels(await res.json().catch(() => null));
      } catch (err) {
        console.warn("[procedures] уровни операций не загружены:", err);
        return EMPTY_PROCEDURE_LEVELS;
      }
    },
    enabled: projectId != null,
    staleTime: Infinity,
    gcTime: 0,
  });
  return query.data ?? EMPTY_PROCEDURE_LEVELS;
}

const NO_RECIPES: Recipe[] = [];

export interface MonitorRecipes {
  recipes: Recipe[];
  isLoading: boolean;
  /** Причина неудачной загрузки; 409 — проект не в эксплуатации. Без тоста: его повторял бы каждый выпуск. */
  loadError: string | null;
  reload: () => void;
}

/**
 * Рецепты prod-выпуска (`GET /api/runtime/projects/{id}/recipes`) — ровно те, что исполнит
 * процедура. Не редакторский список: оператору с одним «управлением» редакторские пути
 * отвечают 403, а сохранённый, но не выпущенный рецепт мойка всё равно не знает.
 *
 * Новый выпуск того же проекта: прежний список держим до ответа (`placeholderData`), чтобы
 * шаги идущей мойки не мигали. Другой проект — список пуст сразу.
 */
export function useMonitorRecipes(projectId: number | null, releaseVersionNo: number | null): MonitorRecipes {
  const query = useQuery({
    queryKey: procedureKeys.recipes(projectId, releaseVersionNo),
    queryFn: async (): Promise<Recipe[]> => {
      let res: Response;
      try {
        res = await fetch(`/api/runtime/projects/${projectId}/recipes`);
      } catch (err) {
        console.warn("[procedures] рецепты выпуска не загружены:", err);
        throw new Error("Не удалось загрузить рецепты");
      }
      if (!res.ok) throw new Error(await readBackendError(res));
      const data: unknown = await res.json().catch(() => null);
      return Array.isArray(data) ? (data as Recipe[]) : [];
    },
    enabled: projectId != null,
    staleTime: Infinity,
    gcTime: 0,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === projectId ? previous : undefined,
  });

  return {
    recipes: query.isError ? NO_RECIPES : (query.data ?? NO_RECIPES),
    isLoading: query.isFetching,
    // Во время «Повторить» прежняя ошибка не показывается — идёт загрузка.
    loadError: query.isError && !query.isFetching ? query.error.message || "Не удалось загрузить рецепты" : null,
    reload: () => void query.refetch(),
  };
}
