/**
 * Сообщения синтаксического разбора (acorn) — по-русски для автора схемы.
 *
 * Переведены те, что встречаются на деле: незакрытая скобка или кавычка, лишний символ,
 * повторное объявление, присваивание не туда. Редкие (классы, модули, разделители в
 * числах) остаются как есть: строка и позиция всё равно указывают место, а выдуманный
 * перевод хуже английского оригинала.
 */
const TRANSLATIONS: [RegExp, string | ((...groups: string[]) => string)][] = [
  [/^Unexpected token$/, "неожиданный символ или слово"],
  [/^Unexpected character '(.+)'$/, ch => `недопустимый символ «${ch}»`],
  [/^Unexpected keyword '(.+)'$/, kw => `ключевое слово «${kw}» здесь недопустимо`],
  [/^The keyword '(.+)' is reserved$/, kw => `«${kw}» — зарезервированное слово`],
  [/^Unterminated string constant$/, "строка не закрыта кавычкой"],
  [/^Unterminated template( literal)?$/, "шаблонная строка не закрыта обратной кавычкой"],
  [/^Unterminated comment$/, "комментарий не закрыт (нет */)"],
  [/^Unterminated regular expression$/, "регулярное выражение не закрыто"],
  [/^Identifier '(.+)' has already been declared$/, name => `«${name}» уже объявлено`],
  [/^Missing initializer in (\w+) declaration$/, kind => `у ${kind} нет начального значения`],
  [/^(Assigning to|Binding) rvalue$/, "присваивать можно только переменной или свойству"],
  [/^Invalid number$/, "неверное число"],
  [/^Identifier directly after number$/, "имя сразу после числа"],
  [/^Cannot use keyword 'await' outside an async function$/, "await можно только в async-функции"],
  [/^Illegal newline after throw$/, "после throw нельзя переносить строку"],
  [/^Missing catch or finally clause$/, "у try нет catch или finally"],
  [/^Multiple default clauses$/, "в switch больше одного default"],
  [/^Unsyntactic (break|continue)$/, kw => `${kw} вне цикла или switch`],
  [/^Label '(.+)' is already declared$/, label => `метка «${label}» уже объявлена`],
  [/^Invalid regular expression flag$/, "неверный флаг регулярного выражения"],
  [/^Duplicate regular expression flag$/, "флаг регулярного выражения повторяется"],
  [/^Invalid regular expression: (.*)$/, rest => `неверное регулярное выражение: ${rest}`],
];

export const translateSyntaxMessage = (message: string): string => {
  for (const [re, text] of TRANSLATIONS) {
    const m = re.exec(message);
    if (m) return typeof text === "string" ? text : text(...m.slice(1));
  }
  return message;
};
