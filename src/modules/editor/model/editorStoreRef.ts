// Только тип: значение стора сюда не импортируется, циклической зависимости нет.
import type {useEditorStore} from "./editorStore";

type EditorStore = typeof useEditorStore;

let store: EditorStore | null = null;

/**
 * Ссылка на стор редактора для кода вне его создателя — общих хелперов
 * (`editorStoreInternals`), которым нужны `getState`/`setState`/`temporal`.
 *
 * Импортировать сам стор они не могут: стор импортирует их, и получился бы цикл. Поэтому
 * стор регистрирует себя сразу после создания (`bindEditorStore`), а хелперы, которые
 * вызываются только во время работы, берут его через `editorStore()`.
 */
export const bindEditorStore = (s: EditorStore) => {
  store = s;
};

export const editorStore = (): EditorStore => {
  if (!store) throw new Error("useEditorStore ещё не создан: bindEditorStore не вызывался");
  return store;
};
