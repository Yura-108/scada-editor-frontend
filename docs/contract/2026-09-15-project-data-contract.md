# Данные проекта — контракт для фронта

Дата: 15.09.2026. Спека: `docs/superpowers/specs/2026-09-15-project-data-design.md`.

## Что делает фронт

Раздел «Данные проекта» с вкладками «Таблицы» и «Переменные». Логики нет: фронт только
редактирует набор и зовёт перечитывание.

- **Таблицы** — список таблиц проекта (порядок задаёт сервер: по алфавиту `title`), редактор
  колонок и сетка строк. Сохраняется весь набор одним `PUT`.
- **Переменные** — переезд вкладки со страницы «Автоматизация». Сохранение прежнее:
  `PUT /api/editor/projects/{id}/automation`. Переменная без задачи-писателя теперь отклоняется
  (`variables.name`) — показывать как обычную ошибку поля.
- **Кнопка «Применить данные»** — после сохранения, чтобы задачи `automation` увидели правку.

## Эндпоинты

| Метод | Путь | Ответ |
|---|---|---|
| `GET` | `/api/editor/projects/{projectId}/data` | `200` набор |
| `PUT` | `/api/editor/projects/{projectId}/data` | `200` набор / `400` / `409` |
| `GET` | `/api/editor/data/{projectId}/versions` | история, как у сцен |
| `GET` | `/api/editor/data/{projectId}/versions/{n}` | содержимое версии — форма ответа `GET` |
| `POST` | `/api/editor/data/{projectId}/restore/{n}` | откат |
| `POST` | `/api/automation/projects/{projectId}/data/reload` | `202` / `404` проект не исполняется |

## Форма набора

```ts
type ValueType = "bool" | "int" | "float" | "string" | "json";

interface ProjectDataSet {
  project_id: number;
  version: number | null;          // null — набор ещё не сохраняли
  tables: ProjectDataTable[];
}

interface ProjectDataTable {
  name: string;                    // [A-Za-z_][A-Za-z0-9_]*
  title: string | null;
  description: string | null;
  columns: ProjectDataColumn[];
  rows: ProjectDataRow[];
}

interface ProjectDataColumn {
  name: string;                    // тот же шаблон; "key" нельзя
  title: string | null;
  value_type: ValueType;
  required: boolean;
  default_value: string | null;    // строкой, как у переменных
}

interface ProjectDataRow {
  key: string;                     // непустой, уникальный в таблице
  values: Record<string, unknown>; // значение в типе колонки: number, boolean, string, объект/массив для json
}

interface ProjectDataSaveRequest {
  based_on_version?: number;       // обязателен, если version !== null
  tables: ProjectDataTable[];
}
```

## Ошибки

- `400`: `{ "error": "project_data_invalid", "errors": [{ "table": string | null, "field": string, "message": string }] }`.
  `field`: `name`, `columns.name`, `columns.value_type`, `columns.default_value`, `rows.key`,
  `rows.values`, `tables` (предел 1 МБ на набор).
- `409 version_mismatch` — перезапросить набор и сохранить заново; слияния нет.

## Скрипты

Серверные скрипты (`automation`, `runtime`) читают таблицы `data('таблица')` и
`data('таблица', 'ключ')`. Скриптам фронта (`binding.script`, `component_event.script`) функция
не доступна.
