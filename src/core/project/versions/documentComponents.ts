/**
 * Достаёт корневые компоненты документа редактора из любой формы, в которой бэкенд
 * его отдаёт.
 *
 * Форм три, и они не сводятся друг к другу без этого хелпера:
 *  - обычный GET сцены и `GET …/versions/{n}` — объект документа с `children`;
 *  - ответ `POST …/restore/{n}` — конверт `{components: <документ целиком>}`, то есть
 *    в `components` лежит НЕ массив (контракт версий, §5, «Форма ответа восстановления»);
 *  - ответ сохранения — в `components` действительно массив компонентов (§1).
 *
 * Имя поля у восстановления и у сохранения одно, а тип разный — ровно та ловушка, о
 * которой контракт предупреждает отдельным абзацем. Поэтому разбор живёт в одном месте:
 * промахнуться формой значит отдать `applyServerComponents` пустой массив и молча
 * стереть холст.
 */
export const rootComponentsOf = (doc: unknown): unknown[] => {
  if (Array.isArray(doc)) return doc;
  if (!doc || typeof doc !== "object") return [];

  const obj = doc as Record<string, unknown>;

  if (Array.isArray(obj.children)) return obj.children;
  // Конверт восстановления: внутри `components` — документ, а не список.
  if (Array.isArray(obj.components)) return obj.components;
  if (obj.components && typeof obj.components === "object") {
    return rootComponentsOf(obj.components);
  }

  return [];
};
