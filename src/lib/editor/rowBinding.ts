/**
 * Привязка строки таблицы к тегу хранится прямо в element.properties (без отдельного
 * поля rowBindings), а номер строки закодирован в property_type: "TAG:<row>" вместо
 * голого "TAG". Бэкенд трогать нельзя — новое поле он бы молча не сохранил, а этот
 * формат round-trip'ится как непрозрачная строка (уже так работает для "TAG" сегодня).
 */
const PREFIX = "TAG:";

export const encodeRowPropertyType = (row: number): string => `${PREFIX}${row}`;

export const parseRowBindingRow = (propertyType: string | undefined): number | null => {
  if (!propertyType?.startsWith(PREFIX)) return null;
  const n = Number(propertyType.slice(PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export const isRowBindingProperty = (p: {property_type?: string}): boolean =>
  parseRowBindingRow(p.property_type) !== null;
