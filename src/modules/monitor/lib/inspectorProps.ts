import type {InspectorPropertyDto} from "@/core/runtime";

/** Имя свойства для оператора: `label`, а без него — технический `name`. */
export const inspectorTitle = (p: InspectorPropertyDto) => p.label?.trim() || p.name;

/** Снять черновик свойства — без деструктуризации с неиспользуемой переменной. */
export const withoutDraft = (drafts: Record<number, string>, id: number) => {
  const next = {...drafts};
  delete next[id];
  return next;
};
