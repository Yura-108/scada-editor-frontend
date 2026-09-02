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
  // объект исходных строк значений: RAW.ИмяСвойства
  "RAW",
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

/** Символ-«хвост» незакрытой строки/комментария — до конца кода. */
const CLOSERS: Record<string, string> = {'"': '"', "'": "'", "`": "`"};

const isIdentStart = (ch: string) => /[\p{L}_$]/u.test(ch);
const isIdentPart = (ch: string) => /[\p{L}\p{N}_$]/u.test(ch);

/**
 * Переводит код со старого синтаксиса на новый: `Имя.V` → `Имя`, `Имя.RAW` → `RAW.Имя`.
 *
 * Раньше в скоуп подставлялся объект `{V, RAW}`, и до значения приходилось идти через
 * точку. Точка и путала: `ST` читалось как имя тега, а `.V` — как часть его пути, хотя
 * `ST` — это имя СВОЙСТВА, а `.V` — поле обёртки. Обёртку убрали, но код уже сохранённых
 * схем никуда не делся, и молча сломаться он не должен: `ST.V` на числе даёт `undefined`,
 * а `undefined > 100` — это тихое «условие не выполняется никогда», худший из возможных
 * исходов на мнемосхеме.
 *
 * Применяется при компиляции (рантайм) и при открытии редактора — там же и сохраняется.
 * Идемпотентно: у `Имя` без точки и у `RAW.Имя` переписывать нечего.
 *
 * Разбор посимвольный, а не регуляркой: строки, шаблонные строки и комментарии надо
 * пропускать целиком (`setProp("ST.V", 1)` обязан остаться как есть), а незакрытая
 * кавычка в недописанном коде не должна утаскивать за собой остаток файла.
 */
export const modernizeScopeCode = (code: string, names: readonly string[]): string => {
  if (!code || !names.length) return code;

  const scope = new Set(names);
  let out = "";
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    // Строка/шаблон — до закрывающей кавычки, с учётом экранирования.
    if (CLOSERS[ch]) {
      const quote = CLOSERS[ch];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) j += code[j] === "\\" ? 2 : 1;
      out += code.slice(i, Math.min(j + 1, code.length));
      i = j + 1;
      continue;
    }

    // Комментарии — до конца строки / до `*/`.
    if (ch === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      out += code.slice(i, end === -1 ? code.length : end);
      i = end === -1 ? code.length : end;
      continue;
    }
    if (ch === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      out += code.slice(i, end === -1 ? code.length : end + 2);
      i = end === -1 ? code.length : end + 2;
      continue;
    }

    if (!isIdentStart(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < code.length && isIdentPart(code[j])) j += 1;
    const name = code.slice(i, j);
    i = j;

    // Не наша переменная, либо `obj.ST` — поле чужого объекта.
    if (!scope.has(name) || out.replace(/\s+$/, "").endsWith(".")) {
      out += name;
      continue;
    }

    const field = /^\s*\.\s*(V|RAW)(?![\p{L}\p{N}_$])/u.exec(code.slice(i));
    if (!field) {
      out += name;
      continue;
    }

    out += field[1] === "V" ? name : `RAW.${name}`;
    i += field[0].length;
  }

  return out;
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

/**
 * Скоуп биндинга: свойства-теги элемента (`property_type === "Тег"`, tag_id непустой).
 * Имя каждого свойства становится переменной в коде биндинга, и переменная — это САМО
 * значение: `Test > 100`. Исходная строка доступна как `RAW.Test`.
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
