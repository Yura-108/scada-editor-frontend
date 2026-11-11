// Сопоставление «сырой type параметра базы каналов → виджет».
// Тип приходит с бэка как есть и не нормализуется в прокси/сторе, поэтому здесь —
// единая точка распознавания с нормализацией (регистр/пробелы) и безопасным fallback,
// чтобы рассинхрон (опечатка, другой регистр, новый тип) не давал молча пустую карточку.

export type ParamWidget = 'input' | 'textarea' | 'checkbox' | 'option';

export function resolveParamWidget(rawType: string | null | undefined): ParamWidget {
  switch ((rawType ?? '').trim().toLowerCase()) {
    case 'checkbox':
    case 'bool':
    case 'boolean':
      return 'checkbox';
    case 'textarea':
      return 'textarea';
    case 'option':
      return 'option';
    // input / text / string и ЛЮБОЙ нераспознанный тип → текстовое поле,
    // чтобы карточка никогда не была пустой (в т.ч. при опечатке вроде `cheakbox`).
    default:
      return 'input';
  }
}

const NUMBER = /^-?\d+(\.\d+)?$/;
const INTEGER = /^-?\d+$/;
// Булево в базе каналов — по-разному: «Включен» хранит Delphi-булево -1/0, «Строковый» — 0/1.
const BOOLEAN = /^(-1|0|1|true|false)$/i;

/** Целое или дробное с точкой, в том числе отрицательное: «5000», «-1», «0.5». */
export const isNumericParamValue = (value: unknown): boolean => NUMBER.test(String(value ?? '').trim());

/**
 * Ошибка значения параметра или `null`. Проверяется только текстовое поле (флажок и список
 * неверного значения не дадут).
 *
 * Тип значения — `valueType` с бэкенда (int / float / bool / string): `type` у параметра — это
 * вид поля, а не тип данных. Старый бэкенд `valueType` не присылает — тогда угадываем: числовым
 * считаем параметр, у которого на сервере сейчас число («Период» `5000`, «Протокол» `-1`).
 * Неизвестный `valueType` — как строка, без проверки.
 */
export function paramValueError(
  param: {type: string | null | undefined; value: unknown; valueType?: string | null},
  value: string,
): string | null {
  if (resolveParamWidget(param.type) !== 'input') return null;
  const v = value.trim();
  switch ((param.valueType ?? '').trim().toLowerCase()) {
    case 'int':
      return INTEGER.test(v) ? null : 'Должно быть целое число';
    case 'float':
      return NUMBER.test(v) ? null : 'Должно быть число (дробная часть — через точку)';
    case 'bool':
      return BOOLEAN.test(v) ? null : 'Должно быть 0, 1, -1, true или false';
    case 'string':
      return null;
    case '':
      if (!isNumericParamValue(param.value)) return null;
      return isNumericParamValue(v) ? null : 'Должно быть число';
    default:
      return null;
  }
}

const TRUTHY = ['1', 'true', 'on', 'yes'];

// Терпимое чтение булева значения параметра (бэк отдаёт true/false, но встречаются 1/0/on).
export function isParamChecked(value: unknown): boolean {
  return TRUTHY.includes(String(value ?? '').trim().toLowerCase());
}

/** Пункт выпадающего списка значения параметра. */
export type ParamChoice = {value: string; label: string};

/**
 * Параметры, у которых значение — код, а не число: в поле стояло «Протокол = -1», «Тип опроса = 0»
 * без расшифровки (#16 п. 7). Значения — как их читает бэкенд (`channel` `TagSettings`,
 * `DataTypeResolver`), подписи — что они значат. Ключ — имя параметра в базе каналов.
 */
const PARAM_CHOICES: Record<string, {options: ParamChoice[]; normalize?: (raw: string) => string}> = {
  // Писать ли тег в архив. -1 — TRUE старой базы на Delphi; руками вводили и 1, и true.
  "протокол": {
    options: [{value: "-1", label: "Пишется в архив"}, {value: "0", label: "Не пишется в архив"}],
    normalize: (raw) => (/^(-1|1|true)$/i.test(raw.trim()) ? "-1" : raw.trim() === "" ? "" : "0"),
  },
  // 1 — каждый цикл («Период» тогда не важен), 0 — по «Периоду» в мс.
  "тип опроса": {
    options: [{value: "1", label: "Каждый цикл"}, {value: "0", label: "По периоду"}],
  },
  // Тип тега в реестре шлюза.
  "тип данных": {
    options: [
      {value: "FLOAT", label: "Дробное (FLOAT)"},
      {value: "INT32", label: "Целое (INT32)"},
      {value: "STRING", label: "Строка (STRING)"},
    ],
    normalize: (raw) => raw.trim().toUpperCase(),
  },
};

/**
 * Список значений для параметра `name` или `null`, если это обычное поле. Текущее значение,
 * которого нет в списке, добавляется как есть — список не должен молча подменять то, что лежит
 * в базе. `value` — то, что показывать выбранным.
 */
export function paramChoices(name: string | null | undefined, raw: string): {options: ParamChoice[]; value: string} | null {
  const spec = PARAM_CHOICES[(name ?? "").trim().toLowerCase()];
  if (!spec) return null;
  const value = spec.normalize ? spec.normalize(raw) : raw.trim();
  const known = spec.options.some((o) => o.value === value);
  return {
    value,
    options: known || value === "" ? spec.options : [...spec.options, {value, label: value}],
  };
}
