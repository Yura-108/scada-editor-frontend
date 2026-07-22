import type {PropertyCreateDto} from "@/types/tags.types";
import type {PropertyRef} from "@/types/binding.types";

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
  "setState", "setProp", "self", "setProperty", "runScript",
]);

/** Валидный JS-идентификатор (кириллица допустима: \p{L}); не зарезервирован. */
export const isValidJsIdentifier = (name: string): boolean =>
  /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) && !RESERVED_WORDS.has(name);

/**
 * Уникальное валидное имя JS-переменной для ссылки на свойство. За основу берётся
 * имя свойства, недопустимые символы заменяются на `_`; при коллизии/невалидности
 * добавляется числовой суффикс (isValidJsIdentifier отсекает и зарезервированные слова).
 */
export const uniqueVarName = (raw: string, taken: ReadonlySet<string>): string => {
  let base = (raw || "prop").replace(/[^\p{L}\p{N}_$]/gu, "_");
  if (!/^[\p{L}_$]/u.test(base)) base = `prop_${base}`;
  let name = base;
  let i = 2;
  while (taken.has(name) || !isValidJsIdentifier(name)) name = `${base}_${i++}`;
  return name;
};

export interface TagScope {
  /** Имена переменных скоупа в фиксированном порядке (порядок аргументов fn): сначала теги, затем свойства объектов. */
  names: string[];
  /** Имя тег-переменной → tag_id (ключ подписки/маршрутизации по tags[]). */
  tagIdByName: Record<string, string>;
  /** Имя переменной-свойства → propertyId (ключ маршрутизации по properties[]). */
  propertyIdByName: Record<string, number>;
  /** Переменные, чьи имена непригодны/конфликтуют (невалидный JS-идентификатор или дубль) — для подсказок в UI. */
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
 * У элемента есть хотя бы одно СОХРАНЁННОЕ на сервере свойство ЛЮБОГО типа (числовой id).
 * Нужно для гейта сохранения биндинга, ссылающегося только на свойства других
 * компонентов: `component_property_id` в DTO обязан ссылаться на существующее
 * свойство самого элемента (см. hasSavedTagProperty), но для этого годится и
 * не-тег свойство (проверить на бэкенде — см. план, Risks).
 */
export const hasSavedProperty = (properties: PropertyCreateDto[] | undefined): boolean =>
  (properties ?? []).some(p => typeof p.id === "number");

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

  return {names, tagIdByName, propertyIdByName: {}, invalidNames};
};

/**
 * Дополняет скоуп ссылками на свойства других компонентов (`binding.propertyRefs`).
 * Имена refs дописываются ПОСЛЕ тег-имён (порядок аргументов fn стабилен).
 * Ref пропускается (и попадает в invalidNames), если `varName` невалиден как
 * JS-идентификатор, не имеет числового `propertyId`, или конфликтует с уже
 * занятым именем (тегом или другим ref).
 */
export const withPropertyRefs = (scope: TagScope, refs: PropertyRef[] | undefined): TagScope => {
  if (!refs?.length) return scope;

  const names = [...scope.names];
  const propertyIdByName: Record<string, number> = {...scope.propertyIdByName};
  const invalidNames = [...scope.invalidNames];
  const taken = new Set(names); // имена, уже занятые тегами (и добавляемыми refs)

  for (const ref of refs) {
    const varName = ref.varName;
    if (!varName || typeof ref.propertyId !== "number") continue;
    if (!isValidJsIdentifier(varName) || taken.has(varName)) {
      invalidNames.push(varName);
      continue;
    }
    taken.add(varName);
    names.push(varName);
    propertyIdByName[varName] = ref.propertyId;
  }

  return {names, tagIdByName: scope.tagIdByName, propertyIdByName, invalidNames};
};
