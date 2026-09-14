# Automation: сверка фронта с бэкендом и открытые вопросы

**Дата:** 14.09.2026
**К чему:** план 4 (`docs/contract/2026-09-14-automation-plan-4-frontend.md`) — страница «Автоматизация»,
переменные проекта в привязках, панель «Задачи» в мониторе.
**Сверено с:** `scada-editor-backend`, ветка `main`, коммит `ec49adb` (automation: `b3f2781`…`6b82cef`).
**Фронт:** ветка `nextjs`.

Первая редакция этого файла была списком вопросов «вслепую» — кода automation в репозитории бэкенда тогда
не было. Теперь он есть; большинство вопросов закрыто чтением кода (раздел 1), по ходу найдена и
исправлена одна ошибка фронта (раздел 2). Раздел 3 — то, что осталось решить на стороне бэкенда.

---

## 1. Закрыто сверкой с кодом

| Вопрос | Ответ | Где в бэкенде |
|---|---|---|
| Маршрут `/api/automation/**` в gateway | Есть → `automation:8086` | `gateway/src/main/resources/application.yml` |
| Кто ставит `X-Username` | Gateway из JWT, подделать нельзя | `gateway/.../filter/JwtAuthenticationFilter` |
| Первое сохранение | `based_on_version: null` принимается, пока у набора нет версий; при существующей версии `null` → 400 `{message}`; расхождение → 409 `version_mismatch` (без `conflicts`, слияния нет) | `DocumentVersionService.requireBaseVersion` / `requireBase` |
| GET проекта без набора | 200, `version: null`, пустые `tasks`/`variables`, `watchdog: null`; не проект → 400 | `AutomationService.get` / `requireProject` |
| `timeout_ms: null` | Равно отсутствию поля → 100 | `AutomationService.normalize` |
| Ответ PUT | Полный набор с присвоенными `id` и новым `version`; задачи сопоставляются по `id` — пересохранение не сбрасывает `state` | `AutomationService.apply` |
| Имена задач | Обрезаются (`trim`), уникальность проверяется | `AutomationService.normalize`, `AutomationSetValidator` |
| Формат `field` | Ровно: `name`, `period_ms`, `timeout_ms`, `stale_after_ms`, `inputs`, `outputs`, `writes_variables`, `script`, `variables.name`, `variables.value_type`, `watchdog.tag`, `watchdog.period_ms`. Индексов строк нет. Задача без имени → `task: null`, `field: "name"` | `AutomationSetValidator` |
| Republish без сохранённого набора | 400 `{message}` (`IllegalStateException`) | `AutomationService.republish`, `GlobalExceptionHandler` |
| История | `GET /api/editor/automation/{projectId}/versions`, `…/versions/{n}`, `…/at`, `POST …/restore/{n}`; id — это projectId | `DocumentVersionController.documentType` |
| Restore | Проходит ту же проверку (может ответить 400 `automation_invalid`) и сразу уходит в automation через outbox | `AutomationDocumentSource.restore` → `AutomationService.restoreSet` |
| Статус в WS | `{taskId, name, state, lastRunAt, lastDurationMs, lastError, errorCount, owner}` | `StatePublisher.publishStatus` |
| Статус в REST | `{projectId, taskId, name, state, lastRunAtMs, lastDurationMs, lastError, errorCount, ownerInstance}` — имена отличаются от WS, фронт это учитывает | `AutomationStore.StatusRow` |
| Словарь `state` | Закрытый: `RUNNING`, `DISABLED`, `INPUT_STALE`, `ERROR`, `OVERRUN`. `lastRunAt` — момент такта и у `DISABLED`/`INPUT_STALE` | `TaskState`, `TaskRunner.tick` |
| Повторный `SUBSCRIBE_TASKS` | Безопасен: ещё раз полный список | `RuntimeWebSocketHandler` |
| Кадр только со статусами | Не мешает признаку «данные устарели» — фронт считает его по тегам и свойствам | — |
| Editor и `tag_id: "@var.x"` | Не валидирует — свойство сохраняется | — |
| Переменные в сессии монитора | Runtime подписывает сессию на `@var.*` из свойств, в кадре `tagId: "@var.<имя>"`, при создании сессии — replay последнего значения | `TagSubscriptionIndex.subscriptionKey`, `VariableTags.displayId`, `AutomationStateConsumer.replayVariables` |
| Представление значения | `asText()` JSON-значения: `true`/`false`, `12.5`, строка как есть | `script-core/TelemetryEnvelope.parse` |
| Запись в переменную | Построчно `REJECTED_VARIABLE`, `success: false`; остальные строки запроса выполняются. То же для ACTION, onChange и шагов процедур | `CommandProducer.send`, `TagWriteService.write` |
| Имена переменных | `[A-Za-z_][A-Za-z0-9_.]*` — только латиница, точки разрешены | `AutomationSetValidator.VARIABLE_NAME` |
| API скрипта | `inputs`, `input(alias)` → `{value, good, ageMs, stale}`, `vars`, `write`, `setVar`, `state` (до 64 КБ), `dt`, `firstRun`, `log.info/warn` | `TaskRunner.bindings` |
| Права | Ролевых ограничений нет — любой авторизованный | — |

## 2. Исправлено на фронте по итогам сверки

- **Переменная во входах/выходах.** Валидатор отвергает тег `@var.*` во `inputs`/`outputs`
  («используйте vars и writes_variables»), а таблица входов подсказывала именно его. Подсказка убрана.
- **Ошибки задачи с пробелами в имени.** `errors[].task` приходит обрезанным — сопоставление теперь по `trim()`.
- **Восстановление невалидной версии.** 400 `automation_invalid` без `message` показывался как
  «Не удалось восстановить версию (400)»; теперь в тосте причины из `errors`.
- **`BACKEND_URL_EDITOR`** должен указывать на gateway — отмечено в `.env.example`.

---

## 3. Открытые вопросы к бэкенду

### 3.1 [В] Статусы удалённых задач не удаляются никогда

- `AutomationStore.saveStatuses` — только `INSERT … ON CONFLICT DO UPDATE`, `DELETE` из
  `automation.task_status` нет.
- `StatePublisher` не публикует tombstone `status:<projectId>:<taskId>`.
- `ProjectRegistry.apply` просто останавливает и заново запускает проект с новыми определениями.

**Итог:** задача, удалённая из набора, навсегда остаётся в `GET /api/automation/projects/{id}/tasks`
и в полном списке после `SUBSCRIBE_TASKS` (он собирается из `AutomationStateConsumer.statuses`) —
со своим последним состоянием, например `ERROR`. Бейдж «Задачи: N» в мониторе будет считать её проблемой.

**Предложение:**
1. При применении новой версии определений удалять строки `task_status` исчезнувших `taskId` и
   публиковать tombstone их статусов.
2. Runtime уже делает `remove` на tombstone, но сессиям об этом не сообщает. Нужен сигнал в кадре —
   например элемент `{taskId, removed: true}` в `tasks[]` (фронт уберёт задачу из панели). Альтернатива —
   признак `tasksSnapshot: true` у кадра с полным списком, тогда фронт заменяет список целиком.

### 3.2 [В] Значение по умолчанию переменной не публикуется

`ProjectRuntime.start` кладёт `default_value` в `VariableBoard`, но в `automation.state` значение
попадает только через `StateSink.variable`, то есть после `setVar`. Пока задача не записала переменную
(а выключенная не запишет никогда), в runtime значения нет, и элемент мнемосхемы, привязанный к `@var.x`,
висит под «нет данных».

**Предложение:** при старте проекта публиковать начальные значения всех объявленных переменных.

### 3.3 [В] Переменная всегда `GOOD` и не исчезает

- `StatePublisher.publishVariable` жёстко ставит `quality: "GOOD"`.
- Удалённая или переименованная переменная, как и переменные остановленного/удалённого проекта,
  остаётся в compacted-топике под ключом `var:<projectId>:<имя>` — tombstone не публикуется.

**Итог:** при остановленном сервисе automation, после удаления набора или переименования переменной
мнемосхема продолжает уверенно показывать последнее значение как достоверное. Для SCADA это худший
вариант отказа: оператор не отличает живое значение от застывшего.

**Предложение (решение за бэкендом):** tombstone при удалении переменной и проекта; `quality: BAD` для
переменных проекта, который перестал исполняться (или признак возраста значения, по которому runtime
сам переведёт его в `BAD`).

### 3.4 [Н] `X-Username` отсутствует — 500 вместо 400

`AutomationController.save` и `DocumentVersionController.restore` требуют `@RequestHeader("X-Username")`.
При обращении к editor в обход gateway `MissingRequestHeaderException` уходит в общий обработчик → 500.
Не блокирует (фронт ходит через gateway), но диагностику сбивает.

---

## Что фронт поменяет по ответам

| Ответ | Где правка |
|---|---|
| 3.1 — признак удаления или полного списка в кадре | `src/lib/runtime/runtimeConnection.ts` (`onmessage`), `useAutomationTasksStore.pushTaskStatuses` |
| 3.2, 3.3 | Ничего: фронт уже показывает «нет данных» для отсутствующего значения и `BAD` |
