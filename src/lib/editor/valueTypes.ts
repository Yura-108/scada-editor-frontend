/**
 * Бэкенд (RecipeApplyService.parseBoolean) строго парсит булевы строки только для
 * value_type "bool"/"boolean" — любое другое написание значения (не из списка
 * true/1/on/yes/да, false/0/off/no/нет) теперь ошибка строки, а не молчаливый false.
 * Поэтому значение такой строки вводится чекбоксом, а не свободным текстом.
 */
export const isBooleanValueType = (valueType: string | undefined): boolean =>
  ["bool", "boolean"].includes((valueType ?? "").trim().toLowerCase());
