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

const TRUTHY = ['1', 'true', 'on', 'yes'];

// Терпимое чтение булева значения параметра (бэк отдаёт true/false, но встречаются 1/0/on).
export function isParamChecked(value: unknown): boolean {
  return TRUTHY.includes(String(value ?? '').trim().toLowerCase());
}
