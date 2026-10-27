import {EMPTY_PROCEDURE_LEVELS, PROCEDURE_OPERATIONS, type ProcedureLevels} from "@/types/access.types";

/** Ответ бэкенда как есть, но без лишних ключей и с `null` на месте отсутствующих. */
export const parseProcedureLevels = (raw: unknown): ProcedureLevels => {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {...EMPTY_PROCEDURE_LEVELS};
  for (const op of PROCEDURE_OPERATIONS) {
    const v = src[op];
    out[op] = typeof v === "number" ? v : null;
  }
  return out;
};
