import {useCallback, useMemo} from "react";
import {useParamTypes} from "@/core/devices";
import type {ParamTypeName} from "../lib/describeLog";

/** Название типа параметра по его номеру из записи журнала; `null` — справочник не знает. */
export function useParamTypeName(): ParamTypeName {
  const types = useParamTypes();
  const byId = useMemo(() => new Map(types.map(t => [String(t.id), t.name] as const)), [types]);
  return useCallback((idType: unknown) => (idType == null ? null : byId.get(String(idType)) ?? null), [byId]);
}
