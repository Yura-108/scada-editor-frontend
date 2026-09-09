import type {Recipe, RecipeCreatePayload, RecipeTag, RecipeValueType} from "@/types/recipe.types";

/**
 * Клиентская проверка рецепта — зеркало серверной (`RecipeServiceImpl`).
 *
 * Не заменяет её, а избавляет от круга до сервера ради предсказуемого 400: бэкенд
 * отбивает пустые `steps`, действие на необъявленный тег и значение не по типу.
 */

/** Приведение введённого текста к типу, объявленному в манифесте. */
export function coerceActionValue(raw: string, valueType: RecipeValueType | undefined): unknown {
  const trimmed = raw.trim();

  if (valueType === "bool") {
    if (/^(true|1|да)$/i.test(trimmed)) return true;
    if (/^(false|0|нет)$/i.test(trimmed)) return false;
    // Нераспознанное оставляем строкой: пусть проверка честно скажет «не по типу»,
    // чем в ПЛК уедет противоположная уставка.
    return trimmed;
  }

  if (valueType === "number") {
    if (trimmed === "") return trimmed;
    const num = Number(trimmed.replace(",", "."));
    return Number.isFinite(num) ? num : trimmed;
  }

  return trimmed;
}

/** Текстовое представление значения для поля ввода. */
export const actionValueText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

/** Совпадает ли значение с объявленным типом — та же таблица, что у `requireTypeMatch`. */
export function valueMatchesType(value: unknown, valueType: RecipeValueType | undefined): boolean {
  switch (valueType) {
    case "number": return typeof value === "number";
    case "bool": return typeof value === "boolean";
    case "string": return typeof value === "string";
    // Тип не объявлен — бэкенд не проверяет (`default -> true`), и мы тоже.
    default: return true;
  }
}

/** Список проблем; пустой — можно отправлять. */
export function validateRecipe(payload: RecipeCreatePayload | Recipe): string[] {
  const problems: string[] = [];

  if (!payload.name?.trim()) problems.push("Укажите название рецепта");

  const tags: RecipeTag[] = payload.tags ?? [];
  const byName = new Map<string, RecipeTag>();
  for (const tag of tags) {
    const name = tag.name?.trim();
    if (!name) {
      problems.push("У тега манифеста пустое имя");
      continue;
    }
    if (byName.has(name)) {
      // Имя — ключ, по которому на тег ссылается шаг; дубль сделал бы ссылку неоднозначной.
      problems.push(`Имя тега «${name}» встречается в манифесте дважды`);
      continue;
    }
    if (!tag.tag?.trim()) problems.push(`У тега «${name}» не указан путь`);
    byName.set(name, tag);
  }

  if (!payload.steps?.length) {
    problems.push("Нужен хотя бы один шаг");
    return problems;
  }

  payload.steps.forEach((step, index) => {
    const label = step.name?.trim() || `Шаг ${index + 1}`;

    for (const action of step.action ?? []) {
      const tag = byName.get(action.tag?.trim() ?? "");
      if (!tag) {
        problems.push(`${label}: тег «${action.tag}» не объявлен в манифесте`);
        continue;
      }
      if (!valueMatchesType(action.value, tag.value_type)) {
        problems.push(
          `${label}: значение «${actionValueText(action.value)}» не подходит тегу «${tag.name}»`
          + ` с типом «${tag.value_type}»`,
        );
      }
    }

    if (step.timeout_ms != null && (!Number.isFinite(step.timeout_ms) || step.timeout_ms <= 0)) {
      problems.push(`${label}: таймаут должен быть положительным числом миллисекунд`);
    }
  });

  return problems;
}
