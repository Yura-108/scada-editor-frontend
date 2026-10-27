import type {EditorState} from "./editorStore";

/**
 * Повторяющиеся сбросы при смене документа. Функции, а не константы: каждый вызов даёт
 * новые `[]` и `{}` — на ссылке массива `elements` завязаны undo и флаг изменений.
 */

/**
 * Пустой холст: ни сцены, ни элементов, ни выделения. Иначе на холсте остались бы
 * данные предыдущей сцены (с её parentKey — при сохранении они потерялись бы).
 */
export const emptyDocument = (): Partial<EditorState> => ({
  scene: null,
  elements: [],
  selectedIds: [],
  activeGroupKey: null,
  selectedTableCell: null,
  currentComponentStateByElementKey: {},
});

/**
 * Документ без версий: номер, история, конфликт, устаревшая база, ошибка автосохранения.
 * Для новой сцены (первое сохранение уйдёт без based_on_version) и удалённой.
 */
export const noVersions = (): Partial<EditorState> => ({
  sceneVersion: null,
  versions: [],
  versionsExhausted: false,
  saveConflict: null,
  staleBaseVersion: null,
  autosaveError: null,
});
