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
