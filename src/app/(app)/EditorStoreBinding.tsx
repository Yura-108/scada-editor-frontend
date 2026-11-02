"use client";

import {ensureEditorStore} from "@/modules/editor";

// Явно и до страниц раздела: срезы ядра (`useOpenScene`, текущий проект, вид сцены) живут в сторе
// редактора и регистрируются при его создании. Без этого раздел, который сам стор не импортирует
// (админка — список проектов через `useOpenScene`), упал бы с «bindOpenSceneStore не вызывался».
ensureEditorStore();

/**
 * Регистрация стора редактора для всей рабочей области. Рисовать нечего — компонент нужен, чтобы
 * этот модуль попал в клиентскую сборку layout и выполнился раньше страниц.
 */
export default function EditorStoreBinding() {
  return null;
}
