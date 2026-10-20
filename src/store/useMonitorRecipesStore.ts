import {create} from "zustand";
import {Recipe} from "@/types/recipe.types";
import {readBackendError} from "@/lib/access/accessErrors";

/**
 * Рецепты prod-выпуска для монитора (`GET /api/runtime/projects/{id}/recipes`) — ровно те, что
 * исполнит процедура. Не редакторский список: оператору с одним «управлением» редакторские пути
 * отвечают 403, а сохранённый, но не выпущенный рецепт мойка всё равно не знает.
 *
 * Перечитывается при смене проекта и выпуска (TREE_CHANGED) — загрузку ведёт `useProcedureSync`,
 * как и уровни операций. 409 — проект не в эксплуатации: список пуст, причина в `loadError`,
 * без тоста (его повторял бы каждый новый выпуск).
 */
interface MonitorRecipesState {
  projectId: number | null;
  recipes: Recipe[];
  isLoading: boolean;
  loadError: string | null;
  load: (projectId: number | null) => Promise<void>;
}

let loadSeq = 0;

export const useMonitorRecipesStore = create<MonitorRecipesState>((set, get) => ({
  projectId: null,
  recipes: [],
  isLoading: false,
  loadError: null,
  load: async projectId => {
    const seq = ++loadSeq;
    // Новый выпуск того же проекта: прежний список держим до ответа, чтобы шаги идущей
    // мойки не мигали. Другой проект — чистим сразу.
    const keep = get().projectId === projectId;
    set({projectId, recipes: keep ? get().recipes : [], isLoading: projectId != null, loadError: null});
    if (projectId == null) return;
    try {
      const res = await fetch(`/api/runtime/projects/${projectId}/recipes`);
      if (seq !== loadSeq) return;
      if (!res.ok) {
        const reason = await readBackendError(res);
        if (seq === loadSeq) set({recipes: [], loadError: reason, isLoading: false});
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      if (seq === loadSeq) set({recipes: Array.isArray(data) ? data as Recipe[] : [], isLoading: false});
    } catch (err) {
      console.warn("[procedures] рецепты выпуска не загружены:", err);
      if (seq === loadSeq) set({recipes: [], loadError: "Не удалось загрузить рецепты", isLoading: false});
    }
  },
}));
