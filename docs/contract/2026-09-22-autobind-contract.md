# Контракт: автопривязка проекта к базе каналов — что добавить на фронте

Дата: 22.09.2026. Бэкенд — ветка `feat/scene-autobind` (коммит `ae8c259`). Покрыто IT
(`AutobindIT`); на стенде ещё не проверено.

Спека — `docs/superpowers/specs/2026-09-22-scene-autobind-design.md`.

## Коротко

После импорта `.cdbx` в базе каналов есть объектная база (`Барановичи-1.Test.LINE1.V0.ST`). Кнопка
«Автопривязка» на проекте редактора сама проставляет теговым свойствам компонентов пути из неё:
**имя компонента — объект, имя свойства — поле**. Компонент `LINE1.V0` (или по-старому `LINE1V0`)
со свойством `ST` получает тег `Барановичи-1.Test.LINE1.V0.ST`.

Связь «проект редактора ↔ база каналов» нигде не хранится — базу выбирают при каждом нажатии.

## Что сделать

Сверено с фронтом 22.09.2026 (только чтение). Всё нужное для выбора базы уже есть — новое только
прокси, действие в сторе и кнопка с диалогом.

### 1. Прокси-маршрут — новый файл

`src/app/api/editor/projects/[projectId]/autobind/route.ts`, по образцу соседнего
`[projectId]/runtime/route.ts` (`protectedRoute`, `parseId`/`badPath`/`passThrough`/
`EDITOR_BACKEND_URL` из `@/lib/editorHistoryProxy`):

```ts
export const POST = protectedRoute(async (req: NextRequest, {token, params}) => {
  const projectId = parseId(params.projectId);
  if (projectId === null) return badPath("Идентификатор проекта должен быть целым числом");
  const body = await req.json().catch(() => null);
  const channelRoot = (body as {channel_root?: unknown} | null)?.channel_root;
  if (typeof channelRoot !== "string" || !channelRoot.trim()) {
    return NextResponse.json({message: "Выберите базу каналов"}, {status: 400});
  }
  const response = await fetch(`${EDITOR_BACKEND_URL}/api/editor/projects/${projectId}/autobind`, {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({channel_root: channelRoot}),
  });
  return passThrough(response);
});
```

`X-Username` не передаём — его проставляет gateway.

### 2. Действие в сторе — `src/store/useEditorStore.ts`

Рядом с `setProjectInOperation`: `autobindProject(projectId, channelRoot) → Promise<AutobindReport | null>`.

- **До запроса:** если открыта сцена этого проекта и `hasUnsavedWork()` — предложить сохранить
  или отменить. Автопривязка пишет новую версию сцены; несохранённая правка потом упрётся в
  расхождение версий (слияние или `409`).
- **После ответа:** если открытая сцена (`scene.id`) есть в `report.scenes` —
  `loadScene(scene.id, {keepHistory: true})`, иначе на холсте останутся старые теги, а следующее
  сохранение затрёт автопривязку.
- Ошибку — тостом через `getErrorMessage`, как соседние действия.

### 3. Кнопка — `src/components/ui/ProjectModal.tsx`

Иконка в строке проекта рядом с переключателем эксплуатации (`handleToggleOperation`), например
`Link2` из `lucide-react`, `title="Автопривязка к базе каналов"`. Открывает диалог (п. 4).

### 4. Диалог «Автопривязка»

1. **Площадка** — `GET /api/device/site/` (прокси есть), массив строк.
2. **База каналов** — `GET /api/device/hierarchy?site=<площадка>` (прокси есть), значение —
   `nodes[].key` целиком (`Барановичи-1.Test`), подпись — последний сегмент. Готовый образец
   обоих запросов — `src/components/channels/StartMenu.tsx`, эффекты 1 и 2.
3. **Предупреждение** под выбором: «Совпавшие теги будут перезаписаны, даже если уже заданы.
   Отменить — восстановлением предыдущей версии сцены».
4. **«Привязать»** → `autobindProject`, кнопка заблокирована на время запроса.
5. **Отчёт** — в том же диалоге вместо формы (таблица ниже).

## Ответ `200`

```json
{
  "channel_root": "Барановичи-1.Test",
  "bound": 2,
  "changed": 2,
  "scenes": [{"scene_id": 8547, "name": "Карта1", "version_no": 99}],
  "not_found": [{"component_id": 8876, "name": "Переключаемый клапан", "scene": "Карта1"}],
  "missing_fields": [{"component_id": 8875, "name": "LINE1.V0", "property": "P_ON_TIME", "scene": "Карта1"}],
  "in_operation": true
}
```

| Поле | Что показать |
|---|---|
| `bound` / `changed` | «Привязано N свойств, изменено M» |
| `scenes` | Список изменённых сцен с новой версией; пустой — «ничего не поменялось» |
| `not_found` | Компоненты, для которых объект в базе не найден: имя, сцена. Их теги не тронуты |
| `missing_fields` | Объект найден, но у него нет поля с именем свойства: компонент, свойство, сцена |
| `in_operation` | `true` — предупреждение: «Проект в эксплуатации — новые теги подхватятся после повторного подъёма» |

У `not_found` поля `property` нет вовсе (не `null`).

## Что не трогается

- свойства «Локальный»;
- свойства с тегом `@var.…` (переменные автоматизации) — ни правки, ни строки в отчёте;
- несовпавшие свойства — остаются с прежним тегом.

Совпавшее свойство перезаписывается, даже если тег у него уже был.

## Ошибки

| Код | Когда | Что показать |
|---|---|---|
| `400` | пустой `channel_root` | «Выберите базу каналов» |
| `404` | нет проекта или в выбранной базе нет каналов | текст `message` из ответа |
| `503` | `channel` недоступен | «База каналов недоступна, ничего не изменено» |

## Откат

Каждая изменённая сцена получает версию `MANUAL`. Отменить автопривязку — восстановить
предыдущую версию сцены обычным образом: `POST /api/editor/scenes/{sceneId}/restore/{versionNo}`
(номер — `version_no - 1` из отчёта, если между ними никто не сохранял).
