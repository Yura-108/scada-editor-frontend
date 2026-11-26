import isEqual from 'lodash/isEqual';
import { basePropertySchema, elementPropertyMap } from './propertiesPanel';

/**
 * Значения «Было / У вас / На сервере» в окне конфликта сохранения (#21).
 *
 * Геометрия и вид элемента лежат в `image` состояния одной JSON-строкой, и сервер присылает
 * конфликт на неё целиком (контракт, §2: «конфликт на весь блоб, без разбора»). Целиком её не
 * прочесть, поэтому, если значения — JSON-объекты, оставляем только поля, которые различаются, с
 * подписями из панели свойств. Остальные значения (уставка свойства и т. п.) — как есть.
 */
export type ConflictLine = { text: string; title?: string };
export type ConflictColumns = {
  base: ConflictLine[];
  yours: ConflictLine[];
  theirs: ConflictLine[];
};

const MAX_TEXT = 60;

/** Геометрия правится в блоке «Геометрия», а не схемами полей — подписи здесь. */
const GEOMETRY_LABELS: Record<string, string> = {
  x: 'Положение X',
  y: 'Положение Y',
  w: 'Ширина',
  h: 'Высота',
  x1: 'X1',
  y1: 'Y1',
  x2: 'X2',
  y2: 'Y2',
  rotate: 'Поворот',
  composition: 'Части компонента',
  // У каждого виджета своя подпись («Цвет полосы», «Цвет фона»…) — без типа берём общую.
  color: 'Цвет',
};

/**
 * Тип элемента в `image` не пишется, а один ключ у разных типов подписан по-разному
 * (`color` — «Цвет заливки» у фигур, «Цвет полосы» у индикатора). Берём самую частую подпись.
 */
let fieldLabels: Map<string, string> | null = null;
const labelOf = (key: string): string => {
  if (!fieldLabels) {
    const votes = new Map<string, Map<string, number>>();
    for (const field of [...basePropertySchema, ...Object.values(elementPropertyMap).flat()]) {
      const byLabel = votes.get(field.key) ?? new Map<string, number>();
      byLabel.set(field.label, (byLabel.get(field.label) ?? 0) + 1);
      votes.set(field.key, byLabel);
    }
    fieldLabels = new Map(Object.entries(GEOMETRY_LABELS));
    for (const [fieldKey, byLabel] of votes) {
      if (fieldLabels.has(fieldKey)) continue;
      fieldLabels.set(fieldKey, [...byLabel].sort((a, b) => b[1] - a[1])[0][0]);
    }
  }
  return fieldLabels.get(key) ?? key;
};

/** Короткий текст; полный — во всплывающей подсказке, если пришлось обрезать. */
const clip = (text: string): ConflictLine =>
  text.length > MAX_TEXT ? { text: `${text.slice(0, MAX_TEXT - 1)}…`, title: text } : { text };

/** Строка поля. Вложенное (части компонента, списки) — коротко, сам JSON — в подсказке. */
const fieldLine = (key: string, value: unknown): ConflictLine => {
  // Старый или неполный ответ может содержать неразбираемое изображение состояния.
  if (key === 'image')
    return { text: `Вид элемента: ${value === undefined ? '—' : 'данные недоступны'}` };
  const label = labelOf(key.startsWith('image.') ? key.slice('image.'.length) : key);
  if (value !== null && typeof value === 'object') {
    const short = Array.isArray(value) ? `${value.length} шт.` : '{…}';
    return { text: `${label}: ${short}`, title: JSON.stringify(value) };
  }
  return clip(`${label}: ${value === undefined ? '—' : String(value)}`);
};

const parseObject = (raw: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const flattenImage = (object: Record<string, unknown>): Map<string, unknown> => {
  const fields = new Map(Object.entries(object));
  const image = fields.get('image');
  const parsed = typeof image === 'string' ? parseObject(image) : image;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    fields.delete('image');
    for (const [key, value] of Object.entries(parsed)) fields.set(`image.${key}`, value);
  }
  return fields;
};

export function conflictColumns(base?: string, yours?: string, theirs?: string): ConflictColumns {
  const raw = [base, yours, theirs];
  const present = raw.filter((v): v is string => v != null);
  const objects = raw.map((v) => (v == null ? undefined : parseObject(v)));

  // Обычные значения — или не все присланные значения разбираются как объекты.
  if (!present.length || objects.some((o, i) => raw[i] != null && o === null)) {
    const plain = (v?: string) => (v == null ? [] : [clip(v)]);
    return { base: plain(base), yours: plain(yours), theirs: plain(theirs) };
  }

  const fields = objects.map((o) => (o ? flattenImage(o) : undefined));
  const keys = [...new Set(fields.flatMap((o) => (o ? [...o.keys()] : [])))];
  const differing = keys.filter((key) =>
    fields.some((o) => !isEqual(o?.get(key), fields[0]?.get(key))),
  );
  const column = (o: Map<string, unknown> | undefined): ConflictLine[] =>
    o ? differing.map((key) => fieldLine(key, o.get(key))) : [];
  return { base: column(fields[0]), yours: column(fields[1]), theirs: column(fields[2]) };
}
