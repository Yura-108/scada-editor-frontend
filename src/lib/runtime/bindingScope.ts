import type {PropertyCreateDto} from "@/types/tags.types";

/**
 * Зарезервированные слова JS — свойство-тег с таким именем нельзя сделать
 * переменной скоупа (new Function бросит SyntaxError на имени параметра).
 */
const RESERVED_WORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for",
  "function", "if", "import", "in", "instanceof", "new", "null", "return", "super",
  "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while",
  "with", "yield", "let", "static", "await", "arguments", "eval",
  // имена API движка — заняты аргументами компилируемой функции
  "setState", "setProp", "self",
]);

/** Валидный JS-идентификатор (кириллица допустима: \p{L}); не зарезервирован. */
export const isValidJsIdentifier = (name: string): boolean =>
  /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) && !RESERVED_WORDS.has(name);

export interface TagScope {
  /** Имена свойств-тегов в фиксированном порядке (порядок аргументов fn). */
  names: string[];
  /** Имя свойства → tag_id (ключ подписки/маршрутизации). */
  tagIdByName: Record<string, string>;
  /** Свойства-теги, чьи имена непригодны как JS-переменные (для подсказок в UI). */
  invalidNames: string[];
}

/**
 * У элемента есть хотя бы одно СОХРАНЁННОЕ на сервере свойство-тег (числовой id).
 * Бэкенд требует, чтобы `bindings[].component_property_id` ссылался на существующее
 * свойство ИМЕННО этого компонента — иначе весь сейв сцены падает 400 (проверено
 * 16.07.2026: "Binding requires component_property_id" / "does not belong to component X").
 * UI обязан блокировать сохранение биндинга, пока это не так.
 */
export const hasSavedTagProperty = (properties: PropertyCreateDto[] | undefined): boolean =>
  (properties ?? []).some(p => p.property_type === "Тег" && typeof p.id === "number");

/**
 * Скоуп биндинга: свойства-теги элемента (`property_type === "Тег"`, tag_id непустой).
 * Имя каждого свойства становится переменной в коде биндинга: `Test.V > 100`.
 */
export const collectTagScope = (properties: PropertyCreateDto[] | undefined): TagScope => {
  const names: string[] = [];
  const tagIdByName: Record<string, string> = {};
  const invalidNames: string[] = [];

  for (const prop of properties ?? []) {
    if (prop.property_type !== "Тег" || !prop.tag_id || !prop.name) continue;
    if (!isValidJsIdentifier(prop.name)) {
      invalidNames.push(prop.name);
      continue;
    }
    if (prop.name in tagIdByName) continue; // дубль имени — берём первое
    names.push(prop.name);
    tagIdByName[prop.name] = prop.tag_id;
  }

  return {names, tagIdByName, invalidNames};
};
