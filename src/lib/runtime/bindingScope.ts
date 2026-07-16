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
