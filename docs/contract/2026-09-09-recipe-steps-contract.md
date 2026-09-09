# Контракт: процедурные рецепты (шаги) — что появилось, что убрано, что сделать на фронте

Дата: 09.09.2026. Backend-часть (`editor` + `runtime`) готова, протестирована и слита в `main`.
Реализация на фронте (`scada-editor-frontend`) — отдельная задача в том репозитории.

## Коротко: что случилось

`Recipe` переработан целиком:

- **Было** — плоский набор `property_name → value`, привязанный к одной таблице
  (`component_id`) и различавшийся полем `type` (`recipe` / `station_params`).
  Применялся разом одним вызовом `POST /api/runtime/recipes/apply`.
- **Стало** — процедура: манифест тегов + упорядоченный список шагов, у каждого —
  действие (запись тегов) и условие перехода к следующему. Выполняется пошагово,
  с ручным подтверждением/восстановлением и обратной связью по WebSocket.

Из этого следует три ломающих изменения контракта:

1. **`station_params` убран целиком.** Экран «Параметры станции» (та вкладка, что видна
   на `recipes-panel.png`/`station-params-loaded.png` из прошлой сессии) остался без
   бэкенда — сохранять/применять такие наборы больше нельзя никаким запросом.
2. **`POST /api/runtime/recipes/apply` удалён.** Вместо разового применения — набор
   эндпоинтов управления процедурой (ниже, п. 2).
3. **`GET /api/editor/recipes?componentId=` потерял фильтр.** У рецепта больше нет
   `component_id` — экран «Рецепты» с выпадающим «Компонент…» в текущем виде работать
   не может, список рецептов теперь общий, без группировки по таблице.

---

## 1. `editor`: `/api/editor/recipes` — новая модель

### 1.1 Форма рецепта

```json
{
  "id": "moyka-shchyolochyu-liniya-1",
  "name": "Мойка щёлочью, линия 1",
  "tags": [
    { "name": "P_VRAB", "tag": "LINE1.PARAMS.P_VRAB", "value_type": "number", "description": "Заданный объём операции (л)" },
    { "name": "V101_OPEN", "tag": "LINE1.V101.OPEN", "value_type": "bool", "description": "Клапан подачи щёлочи V101" }
  ],
  "steps": [
    {
      "name": "Подготовка",
      "action": [
        { "tag": "P_VRAB", "value": 500 },
        { "tag": "V101_OPEN", "value": true }
      ],
      "condition_script": "return elapsedMs >= 2000;",
      "timeout_ms": null
    },
    {
      "name": "Подтверждение оператора",
      "action": [],
      "condition_script": "return confirmed;",
      "timeout_ms": null
    }
  ]
}
```

Поля:

- **`id`** — строка, слаг из имени, выделяется один раз при создании, не меняется при
  переименовании (как и раньше).
- **`name`** — обязателен, непустой.
- **`tags[]`** — манифест: все теги, которые рецепт может записать через `action`.
  - `name` — короткое имя, на которое ссылаются шаги в `action[].tag` (не путь тега).
  - `tag` — путь тега в рамках проекта (то, что раньше называлось `tag_id`/каналом).
  - `value_type` — опционально; `"number"` / `"bool"` / `"string"` — используется бэком
    только для проверки при сохранении (см. 1.3), на исполнение не влияет.
  - `description` — опционально, имя тега по-русски для UI.
- **`steps[]`** — обязателен, минимум один элемент.
  - `name` — метка шага для оператора.
  - `action[]` — массив `{ "tag": <имя из tags[].name>, "value": <любое JSON-значение> }`,
    выполняется при входе в шаг. Может быть пустым массивом (шаг без записи, например
    «ждём подтверждения»).
  - `condition_script` — JS-строка или `null`. `null`/пустая строка = «шаг завершается
    сразу после действия». Скрипту доступны переменные `elapsedMs` (мс с начала шага),
    `confirmed` (см. п. 2.3) и функция `readProjectTag(path)` (путь тега, **не** короткое
    имя из `tags[]`) — фронту исполнять/парсить этот скрипт не нужно, это чисто текстовое
    поле, которое редактируется как код.
  - `timeout_ms` — опционально. Не останавливает процедуру, только помечает шаг «завис»
    (событие `STALLED`, см. п. 3), если условие не стало `true` за это время.

Полей `component_id`, `type`, `values` в этой модели больше нет.

### 1.2 CRUD — что изменилось

| Было | Стало |
|---|---|
| `GET /api/editor/recipes?componentId=123` | `GET /api/editor/recipes` — без параметра, отдаёт **все** рецепты одним списком |
| `POST /api/editor/recipes` `{name, type, component_id, values}` | `POST /api/editor/recipes` `{name, tags, steps}` |
| `PUT /api/editor/recipes/{id}` — то же тело | `PUT /api/editor/recipes/{id}` — то же тело, что и `POST` |
| `DELETE /api/editor/recipes/{id}` | без изменений |
| `GET /api/editor/recipes/{id}` | форма ответа — как в 1.1, без `component_id`/`type`/`values` |
| `GET /api/editor/recipes/{id}/resolved` | **эндпоинта больше нет** — резолв тега в путь теперь целиком на стороне `runtime`, фронту он никогда и не был нужен напрямую |

### 1.3 Валидация при сохранении (`POST`/`PUT`) — коды 400

- `steps` пустой или отсутствует → `400`.
- `action[].tag` шага не объявлен ни в одном `tags[].name` → `400`,
  `message` перечисляет неизвестные имена.
- Значение `action[].value` не соответствует `tags[].value_type` тега (например,
  булево значение для тега с `"value_type": "number"`) → `400`.

Форма тела ошибки (общий для `editor`, не только для рецептов):

```json
{ "timestamp": "...", "status": 400, "error": "Bad Request", "message": "Recipe step action references tag(s) not declared in manifest 'tags': [FOO]" }
```

`GET /api/editor/recipes/{id}` на несуществующий `id` → `404`, та же форма тела.

---

## 2. `runtime`: `/api/runtime/recipes/apply` → 6 эндпоинтов управления

### 2.1 Старое — удалено

```
POST /api/runtime/recipes/apply
```
Эндпоинта нет. Любой код, ещё обращающийся сюда, получит `404` от шлюза/`runtime`.

### 2.2 Новое

```
POST /api/runtime/recipes/{id}/start
GET  /api/runtime/recipes/{id}/status?sessionId=...
POST /api/runtime/recipes/{id}/confirm
POST /api/runtime/recipes/{id}/jump
POST /api/runtime/recipes/{id}/abort
GET  /api/runtime/recipes/{id}/resume-guess?sessionId=...
```

`{id}` — id рецепта из `editor` (строка-слаг, см. 1.1).

#### `POST /start` — начать процедуру

Запрос: `{ "sessionId": "<id сессии мониторинга>" }`
Ответ (200) — статус после входа в первый шаг (и мгновенного прохождения тривиальных
условий, если они есть):
```json
{ "recipeId": "moyka-shchyolochyu-liniya-1", "stepIndex": 0, "stepName": "Подготовка", "elapsedMs": 12, "confirmed": false, "completed": false, "stalled": false }
```
`400`, если `sessionId` пуст/сессия не найдена.

#### `GET /status?sessionId=...` — текущее состояние

Тот же формат ответа, что у `/start`. `stepName` — `null`, если процедура уже
`completed: true`. `400` с сообщением `"No active procedure ... — call start first"`,
если для этой сессии+рецепта `/start` (или `/jump`, см. ниже) ещё не вызывался.

#### `POST /confirm` — ручное подтверждение текущего шага

Запрос: `{ "sessionId": "..." }`. Ответ — статус того же вида, что у `/start`.
Работает на **любом** активном шаге, не только на тех, где `condition_script`
буквально проверяет `confirmed` — это общий ручной оверрайд «продолжить сейчас»,
отдельного признака «этот шаг ждёт подтверждения» API не отдаёт: кнопка «Подтвердить»
на экране может быть доступна всегда, пока процедура не завершена.

#### `POST /jump` — ручной выбор/восстановление шага

Запрос: `{ "sessionId": "...", "stepIndex": 2 }`. `stepIndex` — **обязателен**
(0-based, `400` при отсутствии или отрицательном значении, а не тихий переход
на шаг 0). Ответ — статус того же вида.

Важно: `jump` **не требует предварительного `/start`** — если для этой пары
(sessionId, recipeId) ещё нет активной процедуры, `jump` создаёт её и сразу входит
в указанный шаг. Это осознанно — ровно то, что нужно для сценария «runtime
перезапустили, состояние в памяти потеряно, оператор восстанавливает процедуру
через подсказку `resume-guess` + `jump`» (см. ниже).

#### `POST /abort` — прервать процедуру

Запрос: `{ "sessionId": "..." }`. Ответ — `200`, тело пустое. Прерывание
несуществующей процедуры тоже тихо отвечает `200` (не `404`).

#### `GET /resume-guess?sessionId=...` — подсказка после сбоя runtime

Ничего не меняет, только предполагает. Ответ:
```json
{ "suggestedStepIndex": 3 }
```
Использовать после того, как `GET /status` вернул `400` (процедура в памяти
`runtime` не найдена — например, после его перезапуска), чтобы предложить оператору,
на каком шаге процедура, вероятно, остановилась. Подсказка может ошибаться на шагах
с условием на чистом времени/подтверждении (`elapsedMs`/`confirmed` в такой ситуации
не восстановить) — окончательное решение всегда за оператором: показать подсказку,
дать её принять (`jump` на предложенный индекс) или выбрать другой шаг вручную.

### 2.3 Общая форма ошибок `runtime`

Та же форма, что у `editor` (см. 1.3), другой `message`. `400` — невалидный
запрос/нет активной процедуры, `404` — если `editor` не знает такой `recipeId`.

---

## 3. WebSocket: `procedures` — новый третий массив в кадре `UPDATE`

Кадр от `runtime` был `{"type":"UPDATE","tags":[...],"properties":[...]}`,
стал `{"type":"UPDATE","tags":[...],"properties":[...],"procedures":[...]}`.
Поле `procedures` может отсутствовать/быть пустым массивом в кадре, где событий
процедуры не было (как и `tags`/`properties` сегодня).

```json
{ "recipeId": "moyka-shchyolochyu-liniya-1", "stepIndex": 1, "stepName": "Подготовка", "kind": "STEP_STARTED", "message": null }
```

Поля:
- `recipeId` — всегда присутствует.
- `stepIndex` — `null` для `COMPLETED`/`ABORTED` (шага уже нет) и для `WRITE_FAILED`
  (относится к записи внутри шага, не к переходу между шагами).
- `stepName` — `null` для `COMPLETED`/`ABORTED`, присутствует для остальных.
- `kind` — один из:
  - `STEP_STARTED` — вход в шаг (действие применено).
  - `STEP_COMPLETED` — условие шага стало `true`, идём дальше.
  - `WRITE_FAILED` — запись тега из `action` шага не подтверждена шлюзом
    (`message` — какой тег и причина). Показывать оператору как алерт: запись
    в ПЛК уходит без ожидания подтверждения (fire-and-forget), это единственный
    канал узнать об отказе, кроме лога `runtime`.
  - `STALLED` — истёк `timeout_ms` шага, условие всё ещё не выполнено. Процедура
    не останавливается сама, просто сигнал оператору «шаг подозрительно долго не
    завершается» — можно показать плашкой рядом с текущим шагом.
  - `COMPLETED` — процедура выполнена целиком.
  - `ABORTED` — процедура прервана через `/abort`.

---

## 4. Что нужно реализовать на фронте

1. **Экран «Рецепты» (`editor`)** — переделать форму создания/редактирования:
   убрать выбор компонента, добавить редактор манифеста тегов (`tags[]`: имя, путь,
   тип, описание) и редактор шагов (`steps[]`: имя, список действий `{tag, value}`
   с выбором тега из уже введённого манифеста, текстовое поле `condition_script`,
   опциональный `timeout_ms`). Список рецептов — плоский, без группировки.
2. **Экран/панель запуска процедуры (монитор)** — кнопки `start`/`confirm`/`abort`,
   выбор шага для `jump` (плюс кнопка «применить подсказку» после `resume-guess`),
   отображение текущего шага и `elapsedMs`. Подписка на `procedures` в кадре WS —
   обновлять текущий шаг по `STEP_STARTED`/`STEP_COMPLETED`, показывать алерты на
   `WRITE_FAILED`/`STALLED`, финальное состояние на `COMPLETED`/`ABORTED`.
3. **Обработка потери состояния** — если `GET /status` вернул `400` (процедура не
   найдена в памяти `runtime`, например после его перезапуска), дёрнуть
   `GET /resume-guess`, показать предложенный шаг оператору как подсказку с
   возможностью не согласиться и выбрать другой, подтвердить — вызвать `POST /jump`.
4. **Экран «Параметры станции»** — решить, что с ним делать (бэкенд под него не
   реализован; это не техническое решение — заводить бэкенд заново под старую
   модель никто не планирует). Как минимум — не давать открыть/скрыть вкладку, пока
   не решено иначе.

### TypeScript-заготовка (модели, без привязки к конкретным файлам фронта)

```ts
// editor: /api/editor/recipes

export interface RecipeTag {
  name: string;
  tag: string;
  value_type?: "number" | "bool" | "string" | string;
  description?: string;
}

export interface RecipeStepAction {
  tag: string; // ссылка на RecipeTag.name
  value: unknown; // число/bool/строка — как задано в манифесте
}

export interface RecipeStep {
  name: string;
  action: RecipeStepAction[];
  condition_script: string | null;
  timeout_ms: number | null;
}

export interface Recipe {
  id: string;
  name: string;
  tags: RecipeTag[];
  steps: RecipeStep[];
}

export type RecipeCreatePayload = Omit<Recipe, "id">;

// runtime: /api/runtime/recipes/{id}/...

export interface ProcedureStatus {
  recipeId: string;
  stepIndex: number;
  stepName: string | null;
  elapsedMs: number;
  confirmed: boolean;
  completed: boolean;
  stalled: boolean;
}

export type ProcedureEventKind =
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "WRITE_FAILED"
  | "STALLED"
  | "COMPLETED"
  | "ABORTED"
  | string; // неизвестный код — трактовать как информационное сообщение, не падать

export interface ProcedureEvent {
  recipeId: string;
  stepIndex: number | null;
  stepName: string | null;
  kind: ProcedureEventKind;
  message: string | null;
}

// добавить в существующий тип кадра WS:
// interface OutboundMessage { type: "UPDATE"; tags?: TagUpdate[]; properties?: PropertyUpdate[]; procedures?: ProcedureEvent[]; }
```
