# Контракт: `projectId` в запросах архива (тренды и перемотка)

> 19.10.2026. Только фронт (`scada-editor-frontend`, ветка `nextjs`); бэкенд готов с 16.10.2026.
> Задача — scada-1ygb (права на историю тегов при нескольких экземплярах runtime). Места в коде
> проверены по рабочей копии фронта на 19.10.2026.

## Зачем

Архив тегов общий, а права на него проверяет `runtime`: тег должен входить в prod-выпуск проекта,
к монитору которого у пользователя есть доступ (`HistoryAccess`, scada-syn7). Выпуски проектов
подняты только на том экземпляре `runtime`, которому проект назначен.

Сейчас фронт `projectId` не передаёт. Gateway шлёт `/api/runtime/archive/**` на один экземпляр
(`RUNTIME_HOST`), и тот проверяет теги только по своим проектам. Пока все проекты на runtime-1,
это не видно. Как только проект назначат другому экземпляру, тренды и перемотка его сцен начнут
отвечать `403` — у оператора с правами, на проекте, который работает.

С `projectId` запрос сам уходит к экземпляру-владельцу проекта (`OwnerForwardingFilter`) и
проверяется по выпуску именно этого проекта.

## Что сделать

Монитор всегда знает свой проект — `useEditorStore(s => s.currentProject?.id)` (так его берёт
`useRuntimeEngine.ts:158`). Его и передавать.

### 1. `GET /api/runtime/archive/values` — тренд и «значения на момент»

Добавить параметр query `projectId`:

```
GET /api/runtime/archive/values?tag=…&tag=…&from=…&to=…&maxPoints=…&projectId=10554
```

- `src/lib/runtime/archive.ts` — `fetchChunk` / `fetchArchiveValues`: принять `projectId` в `opts`
  и дописать `q.set("projectId", String(projectId))`.
- Вызовы: `src/components/monitor/TrendModal.tsx:115`, `src/lib/runtime/useRuntimeEngine.ts:694`.
- **BFF** `src/app/api/runtime/archive/values/route.ts` собирает query заново из известных полей —
  `projectId` он сейчас выбросит. Переложить: целое положительное, иначе `400`.

### 2. `POST /api/runtime/archive/replay` — перемотка сцены

`projectId` — **параметром query**, не в теле:

```
POST /api/runtime/archive/replay?projectId=10554
{"tags": [...], "from": "…", "to": "…", "after": null}
```

В теле его не класть: пересылку владельцу он из тела запустит, но проверка прав на владельце
читает только query (расхождение — scada-kjdf, projectId из тела replay) — запрос пройдёт как «без
проекта», по всем проектам экземпляра.

- `src/lib/runtime/archive.ts` — `fetchReplayPage`: аргумент `projectId`, URL
  `/api/runtime/archive/replay?projectId=…`.
- Вызовы: `src/lib/runtime/useArchiveReplay.ts:91`, `:120` (страницы с `after` — тот же
  `projectId`).
- **BFF** `src/app/api/runtime/archive/replay/route.ts` — переложить `projectId` из query входящего
  запроса в query исходящего (`proxyProcedure("/api/runtime/archive/replay?projectId=…", …)`).

## Ответы

| Ситуация | Ответ | Что показать |
|---|---|---|
| Всё в порядке | как раньше (контракт `2026-09-28-tag-archive-contract.md`, разделы 3–4) | — |
| Нет права на монитор проекта | `403 {"error":"FORBIDDEN","reason":"NO_PROJECT_ACCESS"}` | уже переводится `describeDenial` |
| Тег не из prod-выпуска этого проекта | `403 {"error":"FORBIDDEN","reason":"PATH_NOT_ALLOWED"}` | то же |
| Проект не назначен ни одному экземпляру runtime | `409 {"message":"Проект … не назначен ни одному экземпляру runtime"}` | `message` как есть |
| Назначение сменили прямо во время запроса | `409`, «повторите запрос» | `message`; можно повторить один раз |

Строже, чем без `projectId`: теги проверяются по выпуску **этого** проекта, а не «хоть какого-то
доступного». Монитор и так просит только теги своей сцены, на нём это не скажется.

## Чего контракт не меняет

- Без `projectId` бэкенд отвечает как раньше — по проектам ответившего экземпляра. Переход можно
  делать по одному эндпоинту.
- Администратор проходит без проверки тегов в обоих вариантах.
- Формат ответов, пределы тегов и точек, глубина 30 суток.
- Позже `projectId` может стать обязательным для всех, кроме администратора, — отдельным решением
  после того, как фронт перейдёт.

## Проверить

1. Открыть монитор проекта, тренд тега — в Network запрос к `/api/runtime/archive/values` с
   `projectId=<id проекта>`, ответ `200`.
2. Перемотка — `POST /api/runtime/archive/replay?projectId=<id>`, все страницы с тем же `projectId`.
3. С двумя экземплярами `runtime`: назначить проект второму (`/api/runtime/instances`), повторить —
   по-прежнему `200` (запрос переслан владельцу).
