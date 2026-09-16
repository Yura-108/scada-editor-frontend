/**
 * Превращения «задача ↔ шаблон» — целиком на фронте: бэкенд задачу из шаблона не создаёт
 * и обратно её не сворачивает. Связи «шаблон → созданные задачи» нет, задача — копия.
 *
 * Модуль намеренно чистый (без React и fetch): его можно прогнать в Node, транспилировав
 * `npx tsc … --module commonjs`, — тем же приёмом в репозитории проверяют round-trip
 * buildComponentTree/transformElements.
 */

import type {AutomationIo, AutomationTask, AutomationVariable} from "@/types/automation.types";
import type {AutomationTaskTemplate, AutomationTemplateIo} from "@/types/automationTemplate.types";

/** Группа для шаблонов без категории: бэкенд хранит там null. */
export const NO_CATEGORY = "Без категории";

/** Пустое и пробельное поле уезжает как null: бэкенд так делает с category, но не с description. */
const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Задача → шаблон. `id` и `enabled` отбрасываем, `tag` становится подсказкой `example_tag`.
 * Имя берётся как есть — инженер поправит его в форме, если такое уже занято.
 */
export const taskToTemplate = (
  task: AutomationTask,
  meta: {category?: string | null; description?: string | null} = {},
): Omit<AutomationTaskTemplate, "id"> => ({
  name: task.name,
  category: blankToNull(meta.category),
  description: blankToNull(meta.description),
  period_ms: task.period_ms,
  // У задачи таймаут может быть null («по умолчанию»), у шаблона такого значения нет.
  timeout_ms: task.timeout_ms ?? undefined,
  stale_after_ms: task.stale_after_ms,
  run_on_stale: task.run_on_stale,
  inputs: task.inputs.map(toTemplateIo),
  outputs: task.outputs.map(toTemplateIo),
  writes_variables: [...task.writes_variables],
  script: task.script,
});

const toTemplateIo = (io: AutomationIo): AutomationTemplateIo => ({
  alias: io.alias,
  example_tag: blankToNull(io.tag),
  value_type: io.value_type,
});

/**
 * Шаблон → черновик задачи. Задача всегда создаётся выключенной: включают осознанно,
 * когда теги проставлены и проверены. Теги пустые — шаблон ни к какому каналу не привязан.
 */
export const templateToDraftTask = (
  template: AutomationTaskTemplate,
  existingNames: string[],
): AutomationTask => ({
  // id нет — задача новая.
  id: null,
  name: uniqueTaskName(template.name, existingNames),
  enabled: false,
  period_ms: template.period_ms,
  timeout_ms: template.timeout_ms ?? null,
  stale_after_ms: template.stale_after_ms,
  run_on_stale: template.run_on_stale,
  inputs: template.inputs.map(toDraftIo),
  outputs: template.outputs.map(toDraftIo),
  writes_variables: [...template.writes_variables],
  script: template.script,
});

const toDraftIo = (io: AutomationTemplateIo): AutomationIo => ({
  alias: io.alias,
  tag: "",
  value_type: io.value_type,
  example_tag: io.example_tag ?? null,
});

/** Имя занято в наборе — добавляем суффикс « (2)», « (3)»… */
export const uniqueTaskName = (name: string, existing: string[]): string => {
  const taken = new Set(existing.map(n => n.trim()));
  const base = name.trim();
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
};

/**
 * Переменные, которых у проекта нет. Набор задач ответит «Переменная 'X' не объявлена»
 * (`field: "writes_variables"`), поэтому предупреждаем сразу при вставке, а не при сохранении.
 */
export const missingVariables = (
  template: AutomationTaskTemplate,
  variables: AutomationVariable[],
): string[] => {
  const declared = new Set(variables.map(v => v.name));
  return template.writes_variables.filter(name => !declared.has(name));
};

/**
 * Снимает клиентские подсказки перед отправкой набора: `example_tag` — наше поле,
 * на бэкенде у задачи его нет. Лишнее поле бэкенд бы проигнорировал, но набор
 * сравнивается целиком, и слать в него мусор незачем.
 */
export const stripIoHints = (tasks: AutomationTask[]): AutomationTask[] =>
  tasks.map(task => ({
    ...task,
    inputs: task.inputs.map(withoutHint),
    outputs: task.outputs.map(withoutHint),
  }));

/** Поля строки io, которые знает бэкенд: перечислены явно, чтобы новое клиентское не уехало само. */
const withoutHint = (io: AutomationIo): AutomationIo => ({
  alias: io.alias,
  tag: io.tag,
  value_type: io.value_type,
});

/**
 * Тело запроса шаблона: всё, кроме `id`. В POST он не нужен, а PUT берёт его из пути —
 * форма шаблона не должна решать это сама, поэтому форма тела живёт здесь.
 */
export const templateBody = (
  template: AutomationTaskTemplate,
): Omit<AutomationTaskTemplate, "id"> => ({
  name: template.name,
  category: template.category ?? null,
  description: template.description ?? null,
  period_ms: template.period_ms,
  timeout_ms: template.timeout_ms,
  stale_after_ms: template.stale_after_ms,
  run_on_stale: template.run_on_stale,
  inputs: template.inputs,
  outputs: template.outputs,
  writes_variables: template.writes_variables,
  script: template.script,
});

export interface TemplateGroup {
  category: string;
  items: AutomationTaskTemplate[];
}

/**
 * Группировка палитры по категориям. Порядок внутри группы — как пришёл с сервера
 * (он уже отсортирован по имени), категории по алфавиту, «Без категории» последней.
 *
 * `groupPalette` из `lib/palette-utils.ts` не подходит: он типизирован на PaletteItemType
 * и подставляет «Другое».
 */
export const groupTemplates = (items: AutomationTaskTemplate[]): TemplateGroup[] => {
  const groups = new Map<string, AutomationTaskTemplate[]>();

  for (const item of items) {
    const category = item.category?.trim() || NO_CATEGORY;
    const bucket = groups.get(category);
    if (bucket) bucket.push(item);
    else groups.set(category, [item]);
  }

  return [...groups.entries()]
    .map(([category, groupItems]) => ({category, items: groupItems}))
    .sort((a, b) => {
      if (a.category === NO_CATEGORY) return 1;
      if (b.category === NO_CATEGORY) return -1;
      return a.category.localeCompare(b.category, "ru");
    });
};
