import type {ConflictKind, VersionKind} from "@/types/editorVersion.types";
import type {Tone} from "@/shared/ui/tone";

/** Подписи видов версий: `kind` отделяет осознанные сохранения от автоматических. */
export const VERSION_KIND_LABEL: Record<VersionKind, string> = {
  MANUAL: "Сохранение",
  AUTOSAVE: "Автосохранение",
  RESTORE: "Восстановление",
};

/** Тон значка вида версии: ручное сохранение — успех, восстановление — предупреждение. */
export const VERSION_KIND_TONE: Record<VersionKind, Tone> = {
  MANUAL: "success",
  AUTOSAVE: "neutral",
  RESTORE: "warning",
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
