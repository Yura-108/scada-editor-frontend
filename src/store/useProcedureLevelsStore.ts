import {create} from "zustand";
import {EMPTY_PROCEDURE_LEVELS, type ProcedureLevels} from "@/types/access.types";
import {parseProcedureLevels} from "@/lib/access/procedureLevels";

/**
 * Уровни операций процедур из prod-выпуска (`GET /api/runtime/projects/{id}/procedure-levels`):
 * по ним сервер проверяет кнопки процедур, по ним же монитор гасит их заранее. Перечитываются
 * при смене проекта и выпуска (TREE_CHANGED) — загрузку ведёт `useProcedureSync`.
 *
 * Не загрузились (проект не в эксплуатации, старый бэкенд) — уровни считаются пустыми, то
 * есть 1: кнопки активны, и при нехватке уровня сервер ответит 403 с нужным уровнем.
 */
interface ProcedureLevelsState {
  projectId: number | null;
  levels: ProcedureLevels;
  load: (projectId: number | null) => Promise<void>;
}

let loadSeq = 0;

export const useProcedureLevelsStore = create<ProcedureLevelsState>(set => ({
  projectId: null,
  levels: EMPTY_PROCEDURE_LEVELS,
  load: async projectId => {
    const seq = ++loadSeq;
    set({projectId, levels: EMPTY_PROCEDURE_LEVELS});
    if (projectId == null) return;
    try {
      const res = await fetch(`/api/runtime/projects/${projectId}/procedure-levels`);
      if (seq !== loadSeq || !res.ok) return;
      set({levels: parseProcedureLevels(await res.json().catch(() => null))});
    } catch (err) {
      console.warn("[procedures] уровни операций не загружены:", err);
    }
  },
}));
