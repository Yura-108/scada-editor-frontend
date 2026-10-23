# Архитектура фронтенда

Этот документ описывает, **как устроен код** и **куда класть новый**. Предметная область (как
работают сцены, рецепты, тренды, выпуски) описана отдельно — в `docs/domain/`.

Документ описывает **целевое** состояние. Код переезжает к нему постепенно (см. «Переезд»), поэтому
старые папки `src/components`, `src/lib`, `src/store` пока существуют рядом с новыми.

---

## 1. Слои

```
src/
  app/        маршруты Next.js: page.tsx, layout.tsx, api/**/route.ts — только тонкие обёртки
  modules/    продуктовые области: editor, monitor, channels, automation, data, logs, admin, auth, …
  core/       доменное ядро, общее для нескольких модулей (сцена, элементы, проект, права)
  shared/     код без бизнес-смысла: ui-kit, утилиты, http-клиент
  server/     код только для BFF (src/app/api): прокси, cookie, protectedRoute
```

**Импорты идут только вниз:**

```
app  →  modules  →  core  →  shared
app/api  →  server  →  shared
```

- `shared` не импортирует ничего из `core`, `modules`, `app`.
- `core` не импортирует `modules`.
- **Модули не импортируют друг друга.** Если редактору и монитору нужно одно и то же — это `core`.
- `server` нельзя импортировать из клиентского кода (`'use client'`), а `modules`/`core` — из `server`.
- Внутрь модуля или раздела `core` заходят только через его `index.ts`, не через внутренние пути.
- `shared` импортируют по прямому пути к файлу (`@/shared/ui/Button`, `@/shared/lib/cn`): общего
  `index.ts` у ui-kit нет, чтобы не тянуть в бандл всё сразу.

### Что где лежит

| Слой | Примеры | Признак |
|---|---|---|
| `shared/ui` | `Button`, `Modal`, `TextInput`, `NumberInput`, `select`, `ContextMenu` | Не знает слов «сцена», «тег», «проект» |
| `shared/lib` | `cn`, `createUuid`, `downloadJson`, `formatLocalDateTime`, `devLog` | Чистые функции общего назначения |
| `shared/api` | `fetchJson`, разбор ошибок | Транспорт без конкретных эндпоинтов |
| `core/scene` | `DiagramElement`, `getRenderedElement`, геометрия, `buildComponentTree`/`transformElements`, Konva-фигуры | Нужно и редактору, и монитору |
| `core/project` | проект, список сцен, `sceneSource`, кэш сцен | Общая «открытая сцена» |
| `core/access` | `grantOf`, `projectAccess`, `accessErrors` | Права, общие для всех модулей |
| `modules/editor` | панели, палитра, инструменты, выделение, сохранение и версии | Только редактор |
| `modules/monitor` | `useRuntimeEngine`, WS, процедуры, архив, тренды-модалки | Только монитор |
| `modules/channels` | дерево устройств, параметры | Только каналы |
| `server` | `protected`, `backendProxy`, `setTokenCookies`, `*Proxy.ts` | Выполняется на сервере Next |

Если непонятно, куда положить файл: начинайте с модуля, которому он нужен. В `core` переносите,
только когда он понадобился второму модулю.

## 2. Устройство модуля

```
modules/editor/
  index.ts           публичный API модуля — всё, что видно снаружи
  ui/                компоненты (по папке на крупный блок: properties-panel/, tools-panel/, …)
  model/             zustand-сторы/слайсы, хуки с состоянием
  api/               запросы к BFF (функции + хуки TanStack Query)
  lib/               чистые функции: без React, без стора, без fetch
  types.ts           типы модуля
```

Не все папки обязательны. Мелкий модуль может состоять из `ui/` и `index.ts`.

Внутри модуля можно импортировать из любой своей папки, но с направлением `ui → model → api/lib`:
`lib` не знает про стор и компоненты, `api` не знает про компоненты.

## 3. Компоненты

**Лимиты:** компонент — до **200 строк** (лучше до 150), файл — до **300 строк**. Это сигнал, а не
закон: если файл длиннее, его почти наверняка можно разделить.

Компонент отвечает за **отображение**. Всё остальное выносится:

| Что в компоненте | Куда вынести |
|---|---|
| Расчёты, преобразования данных, валидация | `lib/*.ts` — чистые функции |
| Состояние формы, обработчики, эффекты, подписки на стор | хук `useXxx.ts` рядом с компонентом |
| Запросы к серверу | `api/` |
| Повторяющиеся куски разметки | подкомпоненты в той же папке |
| Длинные справочники, конфиги полей | `*.config.ts` / `constants.ts` |

**Как разбивать большой компонент** (например `PropertiesPanel.tsx`):

```
ui/properties-panel/
  PropertiesPanel.tsx        оркестратор: раскладка + выбор секций, ~100 строк
  usePropertiesPanel.ts      какие секции показывать, обработчики
  sections/
    GeometrySection.tsx
    TextSection.tsx
    StatesSection.tsx
    …
  propertiesPanel.config.ts  описание полей
  index.ts
```

Порядок: (1) вынести чистые функции в `lib`; (2) вынести логику в хук; (3) разрезать разметку на
подкомпоненты. После каждого шага поведение не меняется — меняется только место кода.

Прочие правила:
- Один экспортируемый компонент на файл, имя файла = имя компонента.
- Пропсы — не больше ~7. Больше — значит компонент делает слишком много или нужен объект/контекст.
- `'use client'` ставится как можно ниже: `page.tsx` по возможности серверный и тонкий.
- `page.tsx` содержит только получение параметров маршрута и `<XxxClient />` из модуля.

## 4. Состояние

Три вида состояния — три инструмента:

| Вид | Пример | Где хранить |
|---|---|---|
| **Серверное** | список проектов, устройства, рецепты, версии, шаблоны | TanStack Query (`api/`) |
| **Клиентское** | выделение, камера, открытая вкладка, фильтр | zustand (`model/`) или `useState` |
| **Realtime** | значения тегов, качество, статусы процедур | отдельный runtime-стор монитора / ref движка |

### Серверное состояние → TanStack Query

Новые загрузки данных пишутся на TanStack Query, а не на `useEffect + fetch + стор`. Query сам
даёт кэш, `isLoading`/`error`, повторные запросы и инвалидацию после мутаций.

```ts
// modules/editor/api/recipes.ts
export const recipeKeys = {
  list: (projectId: number) => ['recipes', projectId] as const,
};

export function useRecipes(projectId: number) {
  return useQuery({
    queryKey: recipeKeys.list(projectId),
    queryFn: () => fetchJson<Recipe[]>(`/api/editor/projects/${projectId}/recipes`),
  });
}
```

- Ключи запросов — в объекте `xxxKeys` рядом с запросами, не строками по месту.
- Ошибки — через `errorTextFromBody` / `describeDenial` (`core/access`), иначе пользователь
  увидит «FORBIDDEN».
- **Исключение — документ сцены.** `elements`, undo (zundo), сохранение с `based_on_version` и
  кэш сцен — это сложная клиентская модель редактирования, она остаётся в zustand. В Query не
  переносится.

**Образец — шаблоны задач** (`src/modules/automation/api/templates.ts`). Как переводить стор:

1. Функции запросов (`fetchXxx`, `createXxx`, …) не меняются — Query только вызывает их.
2. Список — `useQuery` с ключом из `xxxKeys`. Грузится один раз за сессию — `staleTime: Infinity`.
3. Создание/правка — `useMutation`; в `onSuccess` дождаться `invalidateQueries`, затем тост.
   Форма вызывает `mutateAsync` и сама ловит ошибку (подсветка полей).
4. Удаление — `setQueryData` убирает элемент сразу; при ошибке тост и `invalidateQueries`.
5. Компоненты берут хуки из `index.ts` модуля; старый стор удаляется в том же коммите.

Клиент — `src/shared/api/queryClient.ts`, провайдер — `src/app/providers.tsx`. По умолчанию
**выключены** повторы (`retry`) и перечитка при возврате на вкладку (`refetchOnWindowFocus`):
приложение до Query так не делало. Запрос, которому это нужно, включает их у себя.

### Клиентское состояние → zustand

- **Один стор — одна зона ответственности.** Признак плохого стора: в нём есть и загрузка
  проектов, и камера, и выделение.
- Стор до ~300 строк. Больше — делим на **слайсы**:

```ts
// modules/editor/model/selection.slice.ts
export interface SelectionSlice {
  selectedIds: string[];
  select: (id: string | null) => void;
  clearSelection: () => void;
}

export const createSelectionSlice: StateCreator<EditorState, [], [], SelectionSlice> = (set) => ({
  selectedIds: [],
  select: (id) => set({ selectedIds: id ? [id] : [] }),
  clearSelection: () => set({ selectedIds: [] }),
});

// modules/editor/model/editorStore.ts
export const useEditorStore = create<EditorState>()((...a) => ({
  ...createSelectionSlice(...a),
  ...createCameraSlice(...a),
  …
}));
```

- **Подписка только через селектор**: `useStore(s => s.camera.zoom)`; несколько полей —
  `useShallow`. Никогда `useStore()` целиком.
- Производные значения (отфильтрованный список, «есть ли несохранённое») **не хранятся** в сторе —
  считаются в селекторе или хуке.
- Сложная логика экшена — в чистой функции `lib/`, экшен только вызывает её и делает `set`.
  Так логику можно проверить без React.
- Для селекторов, используемых в нескольких местах, — именованные хуки: `useSelectedIds()`,
  `useCamera()`.
- Компоненты не вызывают `useXxxStore.setState` напрямую — только экшены.

### Realtime → отдельно от документа

Значения тегов приходят часто. Они **не должны** лежать в сторе документа редактора (там zundo и
флаг `isDirty`). Правила:

- Рантайм-слой (оверрайды свойств, набор «нет данных») живёт в `useRuntimeOverlayStore`
  (`core/scene`): пишет его монитор, а читает холст, общий для редактора и монитора, поэтому
  стор лежит в `core`, а не в модуле `monitor`.
- Обновления из WS собираются пачкой и применяются одним `set` (так уже делает `flush`).
- Компонент подписывается на свой элемент/тег: `useElementRuntime(key)`, а не на весь объект.
- Особые правила `pendingRef` / `flush` / `SNAPSHOT` — в `docs/domain/monitor.md`, их нельзя ломать.

## 5. Запросы к серверу

- Браузер ходит только в BFF `/api/**` (кроме WS/STOMP, см. `docs/domain/backend-and-bff.md`).
- Все функции запросов модуля — в его `api/`. В компонентах и сторах `fetch` не пишется.
- Новый BFF-маршрут — тонкий: `protectedRoute` + прокси, логика в `src/server/`.

## 6. Именование

| Что | Как |
|---|---|
| Компонент | `PascalCase.tsx`: `PropertiesPanel.tsx` |
| Хук | `useCamelCase.ts`: `usePropertiesPanel.ts` |
| Стор / слайс | `xxxStore.ts` / `xxx.slice.ts` |
| Чистые функции | `camelCase.ts` по смыслу: `snapToGrid.ts`, не `utils2.ts` |
| Папки | `kebab-case`: `properties-panel/` |
| Типы | `types.ts` в модуле или `xxx.types.ts` рядом |

Комментарии и тексты для пользователя — **на русском**.

## 7. Переезд

Правила, пока старая и новая структура живут рядом:

1. **Новый код — сразу в новую структуру.** В `src/components`, `src/lib`, `src/store` новые файлы
   не добавляются.
2. **Старые большие файлы не растут.** Нужна правка в файле длиннее лимита — сначала вынести
   из него кусок, который правишь, потом править.
3. **Перенос и изменение — разные коммиты.** Коммит «переезд»: только `git mv` и правка
   импортов, поведение не меняется. Изменения логики — отдельным коммитом.
4. **Одна задача рефакторинга — одна ветка.** Не «переделать всё», а «вынести runtime из
   `useEditorStore`».
5. **Проверка после каждого шага:** `npm run lint` и `npx tsc --noEmit` — число ошибок не
   больше базового (см. CLAUDE.md).

### План

| # | Шаг | Статус |
|---|---|---|
| 1 | Документация: этот файл, `docs/domain/`, короткий `CLAUDE.md` | готово |
| 2 | ESLint: `max-lines`, границы слоёв — в режиме `warn` (`eslint.config.mjs`) | готово: 22 длинных файла, 28 длинных функций, 44 импорта против слоёв |
| 3 | Создать `shared/` и перенести ui-kit и общие утилиты | готово, см. ниже, что осталось |
| 4 | Вынести runtime-состояние монитора из `useEditorStore` | готово: `core/scene/runtimeOverlayStore`; переключения состояний остались в редакторе (общее поле) |
| 5 | Вернуть `QueryClientProvider`, перевести первый маленький стор на Query | готово: шаблоны задач, рецепты редактора, уровни и рецепты монитора, журнал (форма — zustand, записи — Query: образец разделения клиентского и серверного состояния, `src/modules/logs`). Отложены: `usePaletteStore` (вызывается вне React — нужен общий клиент Query), `useDeviceStore` (сначала разрезать, вместе с переносом «Каналов») |
| 6 | Разрезать `useEditorStore` на слайсы по зонам | в работе: 5 из 6 зон (камера и холст, выделение, сохранение и версии, проекты, сцены) + общие хелперы и буферы вынесены; остался документ (`editorStoreInternals`, `editorSession`), см. ниже |
| 7 | Разбить крупные компоненты: `PropertiesPanel`, `Canvas`, `ToolsPanel`, `WorkSpace`, … | — |
| 8 | Перенести модули в `src/modules/*` | — |

### Что осталось после шага 3

В `shared` перенесено всё, что не зависит от предметной области. В старых папках остались:

| Файл | Почему не в `shared` | Что сделать |
|---|---|---|
| `components/ui/NumberInput`, `TextInput`, `ColorField` | зависят от `lib/editor/historyGroup` (группировка undo редактора) | передавать начало/конец правки через пропсы — тогда в `shared/ui` |
| `components/ui/ReadOnlyBanner`, `AccessLevelSelect` | тексты и типы прав проекта | `core/access` |
| `components/ui/Open*Modal`, `ProjectModal`, `ContextMenu`, `TitleRenderer`, … | бизнес-модалки со сторами | в модули своих областей (шаг 8) |
| `lib/utils.ts` (`GRID`, `snap`), `lib/pickImageFile` | сетка редактора | `core/scene` |

### Зоны `useEditorStore` (для шага 6)

**Стор остаётся один — режется файл.** Зоны меняют друг друга одним `set()` (загрузка сцены
сбрасывает и элементы, и выделение), а undo (zundo) завязан на `elements` этого стора;
несколько сторов сломали бы атомарность. Каждая зона — файл-слайс в
`src/modules/editor/model/slices/<зона>.slice.ts`:

- интерфейс зоны (`CameraSlice`) с комментариями к полям — `EditorState = CameraSlice & …`;
- `createXxxSlice(set, get)` с **узкими** типами: слайс объявляет, что ему нужно от остального
  стора (`CameraDeps = CameraSlice & {elements}`), а не берёт весь `EditorState`;
- стор подмешивает слайс: `...createCameraSlice(set, get)`; 69 импортёров не меняются;
- код переносится без изменений; другие зоны могут писать поля слайса своим `set()`.

Образец — `camera.slice.ts`. Сборка стора пока в `src/store/useEditorStore.ts`; её перенос
и правка импортов — отдельным коммитом, когда зоны разъедутся.

**Общее для нескольких зон** вынесено рядом со слайсами (`src/modules/editor/model/`):

- `editorSession.ts` — буферы и счётчики вне стора (`saveInFlight`, `documentGeneration`,
  `savedElementsSnapshot`, `draftStash`, `versionPreviewStash`, `sceneLoadSeq`, счётчики
  вставки). Раньше модульные `let` в файле стора; теперь `editorSession.x`, чтобы их видели
  все файлы зон.
- `editorStoreRef.ts` — `bindEditorStore` / `editorStore()`: стор регистрирует себя после
  создания, и хелперы берут его отсюда, не импортируя (иначе цикл импортов).
- `editorStoreInternals.ts` — общие хелперы: подмена документа серверным деревом, загрузка
  сцены, вход/выход из просмотра версии, `markSceneSaved`, `hasUnsavedWork`, права. Файл
  длиннее лимита — это промежуточное место: хелперы, нужные одной зоне, уедут в её слайс.
  `hasUnsavedWork`, `canWriteCurrentProject`, `SCENE_EXPORT_FORMAT` по-прежнему
  импортируются из `@/store/useEditorStore` (реэкспорт).

| Зона | Поля / экшены | Куда | Статус |
|---|---|---|---|
| Камера и холст | `camera`, `canvasRect`, `pendingPlacement`, `ensureElementVisible` | `camera.slice` | сделано (`setMonitorView`, `setSheet` пишут `elements` — остались в документе) |
| Выделение | `selectedIds`, `activeGroupKey`, вход/выход из группы, `revealElement`, ячейка таблицы, `editingTextKey`, `editAllStates` | `selection.slice` | сделано. Слайс не меняет `elements`: сдвиг, выравнивание, слои, удаление, дубликат остались в документе. Буфер (`clipboard`, копирование/вставка) — тоже: делит со вставкой модульные счётчики, переедет вместе с ней |
| Сохранение и версии | `isDirty`, `isSaving`, `saveConflict`, `versions`, `versionPreview`, `exportScene`, просмотр и восстановление версий | `versions.slice` | сделано. Зависимости — весь `EditorState`: сохранение читает и пишет почти все зоны. Файл длиннее лимита (`exportScene` ~270 строк) — разбить его — отдельная задача шага 7 |
| Проекты и выпуски | `projectList`, `currentProject`, `createProject`, `releaseProject`, `projectRuntimeFlags` | `projects.slice` (позже `core/project`) | сделано |
| Сцены | `scene`, `sceneList`, `loadScene`, `createScene`, `sceneSource`, `releaseVersionNo` | `scenes.slice` (позже `core/project`) | сделано (`draftStash` — в `editorSession`) |
| Документ | `elements`, группы, компоненты, свойства, привязки, состояния | `document.slice` | — |
| Runtime монитора | ~~`runtimeOverridesByElementKey`, `noDataElementKeys`~~ → `core/scene/runtimeOverlayStore` (шаг 4); `applyRuntimeBatch` пока координирует оба стора | сделано |
