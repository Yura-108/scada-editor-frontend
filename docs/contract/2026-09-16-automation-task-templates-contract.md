# Шаблоны задач автоматизации — контракт для фронта

Дата: 16.09.2026. Спека: `docs/superpowers/specs/2026-09-15-automation-task-templates-design.md`.
Задача: `scada-ewx`. Эндпоинты целиком — `docs/API.md`, раздел «EDITOR — шаблоны задач».

## Что делает фронт

Палитра заготовок задач рядом с редактором автоматизации проекта — как палитра шаблонов
компонентов. Вся логика превращения задача ↔ шаблон на фронте, бэк только хранит и проверяет.

- **Палитра** — список шаблонов, сгруппированный по `category` (пусто → «Без категории»).
  Порядок внутри группы задаёт сервер: по `name`. Палитра **общая для всех проектов**, фильтра
  по проекту нет.
- **«Сохранить как шаблон»** — действие у готовой задачи в наборе автоматизации.
- **«Вставить из палитры»** — добавляет в набор черновик задачи; он ещё не сохранён, пока
  инженер не нажмёт обычное сохранение набора.
- **Правка шаблона** — форма шаблона (то же, что форма задачи, минус «включена» и теги).
- **Удаление шаблона** — без подтверждения на бэке, восстановить нечем: истории у шаблонов нет.

## Эндпоинты

| Метод | Путь | Ответ |
|---|---|---|
| `GET` | `/api/editor/automation-templates` | `200` массив шаблонов целиком, по `name` |
| `GET` | `/api/editor/automation-templates/{id}` | `200` шаблон / `404` |
| `POST` | `/api/editor/automation-templates` | `200` созданный шаблон с `id` / `400` |
| `PUT` | `/api/editor/automation-templates/{id}` | `200` сохранённый шаблон / `400` / `404` |
| `DELETE` | `/api/editor/automation-templates/{id}` | `200` пустое тело / `404` |

Через gateway путь тот же. `X-Username` не нужен — истории у шаблонов нет, автора записывать
некуда. `based_on_version` нет: сохранение перезаписывает шаблон, при одновременной правке
двумя людьми выигрывает последняя запись.

## Форма шаблона

```ts
type AutomationTemplateIo = {
  alias: string;              // [A-Za-z_][A-Za-z0-9_]*, уникален в своём списке
  example_tag?: string | null; // подсказка, НЕ привязка; не проверяется
  value_type: 'bool' | 'int' | 'float' | 'string';
};

type AutomationTaskTemplate = {
  id?: number;                 // в теле POST не нужен, PUT берёт id из пути
  name: string;                // непустое, уникальное среди всех шаблонов
  category?: string | null;    // пустая строка приедет обратно как null
  description?: string | null;
  period_ms: number;           // 100…3 600 000
  timeout_ms?: number;         // 1…period_ms/2; не прислали — 100
  stale_after_ms: number;      // 100…86 400 000
  run_on_stale: boolean;       // не прислали — false
  inputs: AutomationTemplateIo[];
  outputs: AutomationTemplateIo[];
  writes_variables: string[];  // имена переменных проекта — подсказка, переменных шаблон не создаёт
  script: string;
};
```

Отличия от задачи в наборе (`PUT /api/editor/projects/{id}/automation`): **нет `enabled` и
`project_id`**, а у входов и выходов вместо `tag` — `example_tag`. Лишние поля в теле бэк молча
игнорирует, поэтому положить задачу «как есть» нельзя: `tag` пропадёт, `example_tag` останется
пустым. Перекладывать надо явно.

## Превращения — на фронте

Бэк задачу из шаблона не создаёт и обратно её не сворачивает. Связи «шаблон → созданные задачи»
нет: задача — копия, правка шаблона её не трогает, удаление шаблона на задачи не влияет.

**«Сохранить как шаблон»** (задача → шаблон):

```ts
const template = {
  name: task.name,                 // имя по умолчанию, инженер может поправить
  category, description,           // спрашиваем в диалоге
  period_ms: task.period_ms,
  timeout_ms: task.timeout_ms,
  stale_after_ms: task.stale_after_ms,
  run_on_stale: task.run_on_stale,
  inputs:  task.inputs .map(({alias, tag, value_type}) => ({alias, example_tag: tag, value_type})),
  outputs: task.outputs.map(({alias, tag, value_type}) => ({alias, example_tag: tag, value_type})),
  writes_variables: task.writes_variables,
  script: task.script,
};                                  // id и enabled отбрасываем
await POST('/api/editor/automation-templates', template);
```

Имя занято — придёт `400 automation_invalid` с `field: "name"`; показать в поле имени диалога и
дать переименовать, а не падать.

**Вставка из палитры** (шаблон → черновик задачи):

```ts
const draft = {
  // id нет — задача новая
  name: uniqueInProject(template.name),   // занято в наборе — суффикс « (2)»
  enabled: false,                          // всегда выключена
  period_ms: template.period_ms,
  timeout_ms: template.timeout_ms,
  stale_after_ms: template.stale_after_ms,
  run_on_stale: template.run_on_stale,
  inputs:  template.inputs .map(io => ({alias: io.alias, tag: '', value_type: io.value_type})),
  outputs: template.outputs.map(io => ({alias: io.alias, tag: '', value_type: io.value_type})),
  writes_variables: template.writes_variables,
  script: template.script,
};
```

`example_tag` показать подсказкой (`placeholder`) в поле тега — это единственное, для чего он
нужен. Дальше обычный `PUT` набора задач. Пустые теги набор не пропустит: `400 automation_invalid`,
`field: "inputs"`, «У 'F' не задан тег» — то есть вставить и сохранить набор, не заполнив теги,
нельзя, и это ожидаемо.

Переменные из `writes_variables` в проекте может быть не объявлено — набор ответит
«Переменная 'X' не объявлена» (`field: "writes_variables"`). Стоит предупредить прямо при вставке,
сверив список с переменными проекта, а не ждать ошибки сохранения.

## Ошибки

`400` — та же форма, что у набора задач, разбирается тем же обработчиком:

```json
{"error": "automation_invalid",
 "errors": [{"task": "ПИД инкрементный", "field": "name", "message": "Шаблон с таким именем уже есть"}]}
```

`task` — имя шаблона (`null`, если имя пустое), `field` — поле контракта: `name`, `period_ms`,
`timeout_ms`, `stale_after_ms`, `inputs`, `outputs`, `script`. Нарушения приходят **все сразу** —
подсвечивать разом, а не по одному.

`404` — шаблона нет (GET/PUT/DELETE), в общей форме ошибок editor (`timestamp/status/error/message`),
не `automation_invalid`. Повторный DELETE того же id — тоже `404`.

Что не проверяется: `example_tag` (любая строка или `null`), существование тегов и переменных,
пересечение выходов с другими шаблонами или задачами — шаблон ничего не исполняет.

## Чего на бэке нет (и не появится в этой задаче)

- Истории версий шаблона и отката.
- Создания задачи из шаблона на стороне сервера.
- Массового обновления задач при правке шаблона.
- Параметров в тегах (`{station}`, `{line}`) и подстановки тегов по объекту из базы каналов —
  ляжет поверх позже, по псевдонимам.
- Копирования проектов целиком — отдельная задача `scada-ha8`.
