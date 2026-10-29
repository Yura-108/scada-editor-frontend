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
  Состояние, которое живёт в сторе модуля, другой модуль читает через срез в `core` с регистрацией
  (`bindSceneViewStore`, `bindOpenSceneStore`, `bindCurrentProjectStore`): стор регистрирует себя
  сам, сразу после создания.
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
| `core/scene` | `DiagramElement`, `getRenderedElement`, геометрия, лист, `buildComponentTree`/`transformElements` — без React и Konva | Нужно и редактору, и монитору |
| `core/canvas` | фигуры Konva, `CanvasNode`, `useElementRenderState`, тренды | Холст, общий для редактора и монитора |
| `core/project` | список проектов, кэш сцен, версии, выпуски, закреплённые сцены, настройки проекта, срез открытой сцены (`useOpenScene`: проект, список проектов, сцена, выпуск) | Общая «открытая сцена» |
| `core/runtime` | скрипты и привязки (`bindingScope`, `executeBinding`, `eventScript`, `scriptSyntax`), шина событий холст ↔ движок (`runtimeEventBus`), окна меню монитора (`monitorDialogs`) — без React | Скрипты пишет и проверяет редактор, выполняет монитор |
| `core/automation` | набор автоматизации проекта: загрузка, сохранение, публикация, версии, статусы задач (`automationApi`) | Набор правят «Автоматизация» и «Данные», переменные читает выбор тега в редакторе |
| `core/access` | `grantOf`, `projectAccess`, `accessErrors`, `actionAccess`, `sessionUser` | Права, общие для всех модулей |
| `modules/editor` | панели, палитра, инструменты, выделение, сохранение и версии | Только редактор |
| `modules/monitor` | `useRuntimeEngine`, WS, процедуры, архив, тренды-модалки | Только монитор |
| `core/devices` | база каналов: дерево и параметры (`useDeviceTreeStore`), блокировки правки (`useDeviceLocksStore`), справочники (`useDeviceDictionaries`), правка (`deviceActions`), запросы (`api/devicesApi`); UI — `DeviceTreePanel` с меню правки и выбором проекта, модалки меню, `pickTag` | Дерево устройств показывают «Каналы», редактор (выбор тегов) и «Автоматизация» |
| `modules/data` | таблицы данных проекта, переменные, история версий | Только «Данные» |
| `modules/admin` | пользователи, права в проектах, ветки каталога | Только администрирование |
| `modules/channels` | страница каналов: панель параметров, тулбар, импорт `.cdbx` | Только каналы |
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

### UI-kit: цвета

Интерфейс красится **только токенами темы** (`src/app/globals.css`): тема и оттенки меняются в
одном месте, светлая и тёмная не расходятся. Палитровые классы (`gray-500`, `indigo-600`, …),
`white`/`black` и `[#hex]` в интерфейсе не пишутся; `npm run check:ui-colors` считает оставшиеся
и падает, если их стало больше базы (`scripts/ui-colors-baseline.txt`). Перевели файлы — уменьшите
базу.

| Что | Токен |
|---|---|
| Фон страницы | `bg-background` |
| Панель, окно, карточка | `bg-card` (выпадающие списки, меню — `bg-popover`) |
| Шапка таблицы, приглушённый блок | `bg-muted` |
| Наведение на строку или пункт | `hover:bg-accent` |
| Основной текст | `text-foreground` |
| Вторичный текст: подписи, описания, пояснения | `text-muted-foreground` |
| Рамка блока | `border-border` (стоит по умолчанию у всех элементов — можно не писать) |
| Рамка поля ввода | `border-input` |
| Главное действие, акцент, ссылка | `primary` (`bg-primary text-primary-foreground`) |
| Ошибка, удаление | `destructive` |
| Успех, «живые данные» | `success` |
| Предупреждение, несохранённое, «нет связи» | `warning` |
| Справка, «только просмотр» | `info` |
| Выделенный элемент (строка «Слоёв», рамка) | `selection` |
| Рамка открытой группы | `active-group` |
| Тег, канал | `tag` |
| Параметр узла базы каналов | `param` |
| Затемнение под окном | `bg-overlay` |

- Уровней текста два: `foreground` и `muted-foreground`. Промежуточные серые не заводим.
- Мягкий фон и рамка статуса — прозрачностью: `bg-warning/10 border-warning/30 text-warning`.
  Текст на сплошной заливке — `-foreground` того же токена (`bg-destructive text-destructive-foreground`).
- Скругления: поля и кнопки — `rounded-lg`, карточки и панели — `rounded-xl`, окна — `rounded-2xl`.
- Слои — только шкалой `z-*` из `globals.css` (`z-modal`, `z-dropdown`, `z-floating`, …), без чисел.
- **Не интерфейс:** цвета самих схем (заливки и обводки элементов по умолчанию —
  `constants/propertiesPanel.ts`, `constants/palette.ts`, `model/newElement.ts`) — это данные
  документа; палитра холста — строки для Konva в `core/canvas/useThemeColors.ts`. Её `selection` и
  `activeGroup` продублированы в токенах — меняются вместе.

### UI-kit: окна

Все окна приложения — из `src/shared/ui/dialog/`. Свой `Dialog.Root` не заводится: рамка, затемнение,
крестик, шапка и подвал у всех окон одни.

| Что нужно | Что брать |
|---|---|
| Окно с формой, списком, редактором | `openModal(<Content />, {size})` из `modalStore` |
| Окно поверх открытого («Выпуски» из списка проектов) | `pushModal(...)` — закрыли, и нижнее окно на месте с тем, что в нём набрано |
| Да/нет перед действием | `await confirmModal({title, description, danger})` |
| Ввести одну строку (имя) | `await promptModal({title, label})` |
| Больше двух исходов (заменить / добавить / отмена) | `await choiceModal({title, options})` |
| Окно, которое принадлежит компоненту и открыто его состоянием (выбор свойства или тега для привязки) | `<Modal open onClose title footer size>` |

- `openModal` открывает окно **вместо** верхнего («Проекты» → выбор схемы); `pushModal` — **поверх**.
  `closeModal` закрывает верхнее; содержимое окна закрывает себя через `useCloseModal()` — оно
  закрывает именно своё окно, даже если над ним открыто другое.
- Окно, открытое изнутри другого (`Modal` из полноэкранного редактора привязки), само встаёт на
  ступень выше: `DialogFrame` берёт глубину из окна, в котором рендерится. Отдельного слоя для
  вложенных окон нет.
- Подтверждения — отдельный слой (`z-confirm`) поверх всего стека окон.
- Формы (окно, где пользователь что-то вводит) открываются с `closeOnOverlay: false`: случайный клик
  мимо не должен терять набранное. Esc, крестик и «Отмена» закрывают как обычно.
- Ширина — только одна из `DialogSize`: `sm` (подтверждения, ввод имени), `md` (короткие формы),
  `lg` (широкие подтверждения, журнал), `xl` (списки, таблицы; по умолчанию у `openModal`),
  `fullscreen` (редакторы кода, тренды, рецепты).
- Содержимое собирается из `DialogHeader` (заголовок и описание — одним стилем, описание всегда
  в DOM ради скринридера), `DialogBody` (прокручивается) и `DialogFooter` (кнопки `Button`, главное
  действие последним). Подвал закреплён внизу: кнопки всегда на экране. `separated={false}` — без
  линий, для коротких вопросов, где нечему прокручиваться.
- У редакторов кода длинная справка по API скрипта прячется под «?» рядом с заголовком —
  `DialogHeader hint`. Полноэкранное тело — `DialogBody className="flex flex-col gap-4"`: поле кода
  (`flex-1 min-h-0`) занимает всё, что осталось от остальных блоков.
- Пока не переведён один `OpenChooseTagModal` — открывается с `legacyLayout: true` (свои
  `Dialog.Title` и `ModalFooter`, прежняя прокручиваемая область с отступами); его заменит общий
  выбор тега (ветка `tag-picker`). Тогда флаг и старая обёртка в `ModalRoot` удаляются.

### UI-kit: поля

Поля — из `src/shared/ui/field/`. Свой класс поля (`inputClass`, `fieldInput`) в файле не заводится.

| Что нужно | Что брать |
|---|---|
| Подпись + поле + подсказка или ошибка | `<Field label hint error><Input …/></Field>` — id, `aria-describedby`, `aria-invalid` проставляются сами |
| Однострочное поле (в т. ч. `number`, `password`, `datetime-local`) | `Input` |
| Многострочное | `Textarea` |
| Поиск | `SearchInput` (лупа слева) |
| Флажок | `<Checkbox label="…" />` — обычный чекбокс в цвете акцента |
| Выпадающий список | `<Select value onValueChange options placeholder />`; пункты с иконкой — из частей `SelectTrigger`/`SelectContent`/`SelectItem` |
| Число, строка, цвет, которые применяются сразу (панель свойств) | `NumberInput`, `TextInput`, `ColorField` + `{...historyEditing}` из модуля редактора |
| Подпись у не-поля (кнопка выбора файла, редактор кода) | `fieldLabelClass` (`fieldLabelSmClass` — в плотных местах) |
| Выбор проекта в шапке раздела | `ProjectSelect` из `@/core/project` |

- Высоты: `size="md"` — 40px (окна, формы, вход), `size="sm"` — 32px (панель свойств, таблицы, фильтры,
  рабочие страницы «Автоматизация» и «Данные»). У `Button` те же два размера, поэтому поле и кнопка в
  одной строке вровень.
- Подписи — обычным регистром: `text-sm font-medium` у `md`, компактные `text-xs` у `sm`
  (`<Field size="sm">`, `fieldLabelSmClass`). Мелких заглавных нет.
- `Select` с пунктом `value: ""` («Без проверки», «Все») работает: Radix такое значение запрещает,
  компонент подменяет его внутри. Список раскрывается под триггером (`popper`).
- `NumberInput`/`TextInput`/`ColorField` сами об истории не знают: о начале, конце и отмене правки
  сообщают `onEditStart`/`onEditEnd`/`onEditCancel` (`EditSession`); редактор склеивает правку в один
  шаг undo через `historyEditing` (`modules/editor/model/historyGroup`).
- ESLint (`no-restricted-syntax`, warn) отмечает свой `<select>`/`<textarea>` и прямой импорт Radix Select вне
  `shared/ui/field`. Исключения: `OpenChooseTagModal` со своим Radix Select (`SelectItem`, `selectStyles`) —
  до ветки `tag-picker`; редактор текста на холсте (`TextEditorOverlay`) — насовсем, он обязан выглядеть
  как текст фигуры.

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
| 5 | Вернуть `QueryClientProvider`, перевести первый маленький стор на Query | готово: шаблоны задач, рецепты редактора, уровни и рецепты монитора, журнал (форма — zustand, записи — Query: образец разделения клиентского и серверного состояния, `src/modules/logs`). Отложены: `usePaletteStore` (вызывается вне React — нужен общий клиент Query), `useDeviceStore` — разрезан на шаге 8 (`core/devices`: дерево, блокировки, справочники, правка), на Query переводить по частям |
| 6 | Разрезать `useEditorStore` на слайсы по зонам | готово: стор собирается в `src/modules/editor/model/editorStore.ts` из 12 слайсов (`model/slices/`), импорт — `@/modules/editor`. Длинные функции внутри слайсов (`addElementAt`, `exportScene`, группировка) — шаг 7 |
| 7 | Разбить крупные компоненты: `PropertiesPanel`, `Canvas`, `ToolsPanel`, `WorkSpace`, … | готово для модуля редактора: разрезаны `PropertiesPanel`, `Canvas`, `ToolsPanel`, `WorkSpace` (`modules/editor/ui/`) и все слайсы стора. Крупные файлы других областей (`useRuntimeEngine`, `AutomationClient`, `DataClient`, …) — вместе с их переездом на шаге 8 |
| 8 | Перенести модули в `src/modules/*` | в работе: `core/scene` — отображаемый вид, геометрия, лист и вид, сериализация, чистые данные элементов (активные состояния — `bindActiveStateReader`, срез сцены — `bindSceneViewStore`); `core/canvas` — фигуры Konva (React/Konva только здесь, стор их не тянет); `core/access` — права (текущий проект — `bindCurrentProjectStore`); `core/project` — проекты, кэш сцен, версии, выпуски, закреплённые сцены, настройки. Модуль редактора: `components/editor` и `lib/editor` переехали в `modules/editor` (`ui/` — панели, палитра, слои, привязки, события, рецепты, версии, выпуски; `model/` — хелперы стора, `historyGroup`, `lastProject`, `openScene`; `lib/` — чистые функции); общее — в `core/scene` (`tags/` — `tagPath`, `valueTypes`; `element/` — `rowBinding`, `templateRoot`). Снаружи берут через `@/modules/editor`: монитор — `SceneTabs`, `useSceneCameraMemory`; страницы — `restoreLastProject`, `useEditableProject`. Остались на месте: шапка приложения (`HeaderNav`, `LogoLink`, `navItems`), `deviceTreeData` (переедет с «Каналами»), `procedureHudPrefs` (с монитором), `usePinnedScenesStore`. Большие файлы перенесены как есть, разрезать отдельно: `RecipesPanel`, `LayersPanel`, `useStageInteractions`, `transformSelection`, `deviceLayoutImport`. `core/runtime` — скрипты, привязки и шина событий; окна меню монитора — регистрацией (`bindMonitorDialogs`, вызывает `registerMonitorDialogs` из `@/modules/monitor` на страницах редактора и монитора). Модуль монитора: `components/monitor` → `modules/monitor/ui/`; `lib/runtime` → `model/engine/` (`useRuntimeEngine`, `runtimeConnection`, привязки), `model/archive/`, `model/procedures/`; сторы процедур, плеера, плавающих окон и задач автоматизации → `model/`; `actionLog` → `api/`. Открытый проект и сцену монитор читает через срез `core/project/openScene` (`useOpenScene`/`getOpenScene`), элементы и запись рантайм-состояний — через `core/scene/sceneView`; состояние осталось в сторе редактора (загрузка сцены пишет документ, историю и черновик), `@/modules/editor` монитор не импортирует. Разрезать отдельно: `useRuntimeEngine`, `ObjectInspectorModal`, `runtimeConnection`, `ElementOptionsModal`, `ProcedureHud`, `MonitorClient`. Редакторы привязки и скрипта события разрезаны: общие части — `properties-panel/script/` (поле кода, тест-прогон, чипы скоупа, `useScriptDraft`), логика — `useBindingEditor` и `useEventScriptEditor`; редактор рецепта — секции в `recipes/editor/`; тренд — `monitor/ui/trend/` и `monitor/lib/trendTime`. Каналы: `useDeviceStore` разрезан на части в `core/devices` (дерево, блокировки, справочники, правка; все `fetch` — в `api/devicesApi`), туда же хуки блокировок и `treeSearch`. UI базы каналов — в `core/devices/ui` (`DeviceTreePanel`, `ChannelsProjectPicker`, `TitleRenderer`, `DeviceContextMenu`, модалки меню), `deviceTreeData` и `paramWidget` — в `core/devices/lib`. Страница: `ChannelsToolbar`, `DeviceParams`, импорт `.cdbx` — в `modules/channels/ui`, `components/channels` больше нет. Разрезать отдельно: `DeviceParams` (значение параметра уже вынесено в `ParamValueField`, поиск дерева — в `TreeSearchBox`). Автоматизация: редакторы задач, шаблонов и сторожевых таймеров, IO-таблица, палитра шаблонов — в `modules/automation/ui`, черновик и шаблоны — в `lib/`; запросы набора — в `core/automation`, `VersionHistoryList` — в `shared/ui`. `AutomationClient` (649 строк) пока в `app`, разрезать отдельно. Данные: таблицы, столбцы, строки, переменные и изменения версий — в `modules/data/ui`, запросы — в `api/`, значения и сравнение версий — в `lib/`; `DataClient` (485 строк) пока в `app`. Админка: вкладки (пользователи, права, ветки) — в `modules/admin/ui`, запросы — в `api/`; список проектов — через `useOpenScene`; `AdminClient` в `app` — только шапка с вкладками. BFF: `protected`, `setTokenCookies`, `auth`, `authProxy` — в `src/server/auth` (`getUser` остался в `lib`, переедет с layout). Дальше: разбор `components/ui`, `lib` и `store`, шапка приложения |

### Что осталось после шага 3

В `shared` перенесено всё, что не зависит от предметной области. В старых папках остались:

| Файл | Почему не в `shared` | Что сделать |
|---|---|---|
| `components/ui/ReadOnlyBanner`, `AccessLevelSelect` | тексты и типы прав проекта | `core/access` |
| `components/ui/Open*Modal`, `ProjectModal`, `ContextMenu`, `TitleRenderer`, … | бизнес-модалки со сторами | в модули своих областей (шаг 8) |

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

Образец — `camera.slice.ts`. Стор собирается в `src/modules/editor/model/editorStore.ts`: он
подмешивает слайсы через относительные импорты (`./slices/…`), а снаружи его берут из
`@/modules/editor`. Внутри модуля `@/modules/editor` не импортируют — только относительные
пути, иначе модуль замкнётся на собственный `index.ts`.

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
  `hasUnsavedWork`, `canWriteCurrentProject`, `SCENE_EXPORT_FORMAT` снаружи берут из
  `@/modules/editor`.

| Зона | Поля / экшены | Куда | Статус |
|---|---|---|---|
| Камера и холст | `camera`, `canvasRect`, `pendingPlacement`, `ensureElementVisible` | `camera.slice` | сделано (`setMonitorView`, `setSheet` пишут `elements` — остались в документе) |
| Выделение | `selectedIds`, `activeGroupKey`, вход/выход из группы, `revealElement`, ячейка таблицы, `editingTextKey`, `editAllStates` | `selection.slice` | сделано. Слайс не меняет `elements`: сдвиг, выравнивание, слои, удаление, дубликат остались в документе. Буфер (`clipboard`, копирование/вставка) — тоже: делит со вставкой модульные счётчики, переедет вместе с ней |
| Сохранение и версии | `isDirty`, `isSaving`, `saveConflict`, `versions`, `versionPreview`, `exportScene`, просмотр и восстановление версий | `save.slice` (сохранение, конфликты) и `versions.slice` (история, просмотр, восстановление) | сделано. Зависимости — весь `EditorState`: сохранение читает и пишет почти все зоны. В лимите: запрос — `api/saveScene.ts`, проверки — `model/saveGuards.ts`, замок и подмена холста — `model/saveFlow.ts`, поиск и тост истории — `model/versionHistory.ts` |
| Проекты и выпуски | `projectList`, `currentProject`, `createProject`, `releaseProject`, `projectRuntimeFlags` | `projects.slice` (позже `core/project`) | сделано |
| Сцены | `scene`, `sceneList`, `loadScene`, `createScene`, `sceneSource`, `releaseVersionNo` | `scenes.slice` (позже `core/project`) | сделано (`draftStash` — в `editorSession`). В лимите: запросы — `api/scenes.ts`, стеш — `model/draftStash.ts`, сбросы — `model/scenePatches.ts` |
| Документ | `elements`, группы, компоненты, свойства, привязки, состояния, буфер | хелперы `elementTree.ts`, `elementStates.ts`; слайсы `layout`, `states`, `properties`, `elements`, `clipboard`, `groups` | сделано. `elements.slice` в лимите (чистые функции рядом: `newElement`, `placeNewElement`, `visualPatch`, `removeElements`, `metaElement`). все слайсы в лимите: операции групп — `model/groupOps/`, нормализация импорта — `model/importElements.ts` |
| Runtime монитора | ~~`runtimeOverridesByElementKey`, `noDataElementKeys`~~ → `core/scene/runtimeOverlayStore` (шаг 4); `applyRuntimeBatch` пока координирует оба стора | сделано |
