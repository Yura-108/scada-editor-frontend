import type {ConflictKind, VersionKind} from "@/types/editorVersion.types";

/** Подписи видов версий: `kind` отделяет осознанные сохранения от автоматических. */
export const VERSION_KIND_LABEL: Record<VersionKind, string> = {
  MANUAL: "Сохранение",
  AUTOSAVE: "Автосохранение",
  RESTORE: "Восстановление",
};

export const VERSION_KIND_BADGE: Record<VersionKind, string> = {
  MANUAL: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  AUTOSAVE: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/30",
  RESTORE: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export const CONFLICT_KIND_LABEL: Record<ConflictKind, string> = {
  BOTH_MODIFIED: "Изменено обоими",
  DELETED_BY_THEM: "Удалено другим пользователем",
  DELETED_BY_YOU: "Удалено вами",
  BOTH_ADDED: "Создано обоими",
};

/**
 * Путь, которым контракт адресует конфликт порядка компонентов ВЕРХНЕГО УРОВНЯ сцены.
 *
 * У порядка корней нет родителя, к которому можно приписать путь, поэтому под него
 * зарезервирована ровно эта строка (§2 контракта). Компонента с таким именем внутри
 * сцены быть не должно — совпадение считается признаком именно этого случая.
 */
export const SCENE_ORDER_CONFLICT_PATH = "Сцена";

/** Человекочитаемая подпись пути конфликта. */
export const formatConflictPath = (path: string): string =>
  path === SCENE_ORDER_CONFLICT_PATH ? "Порядок компонентов сцены" : path;

/** Дата версии в локальном формате; пустая строка вместо «Invalid Date» на кривом вводе. */
export const formatVersionTime = (iso: string): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
