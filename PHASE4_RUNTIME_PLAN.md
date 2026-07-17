# План Фазы 4 — «Рантайм (живые данные)»

> Детальный план реализации Фазы 4 из [ROADMAP.md](./ROADMAP.md). Составлен 15.07.2026 по итогам
> разведки кода (WS-инфраструктура, модель биндингов/тегов, поверхность режима просмотра).
>
> **Статус 16.07.2026: Phase A (MVP) реализована** — WP1 (типы+round-trip+CRUD), WP4
> (`runtimeConnection.ts` + BFF-прокси сессий), WP5 (движок: setState И setProp; `properties[]`
> из UPDATE пока игнорируются), WP3 (`/monitor` + `readOnly` через `Layer listening=false`),
> WP2 (вкладка «Привязки» + CodeMirror + тест-прогон). Проверено: tsc baseline 10/10,
> headless-тест 29/29 PASS, полный конвейер на живом стенде (симулятор→Kafka→runtime→WS→интент).
> Ответы стенда на вопросы №8–12 — в WP6 ниже. Остались Phase B/C.

## Контекст

Продукт сегодня — только design-time редактор: WebSocket смонтирован, но не активирован; `bindings` — мёртвые данные (никто не создаёт и не применяет); скрипты — инертные Java-блобы; живой мнемосхемы нет. Фаза 4 закрывает этот разрыв — это главное отличие от «настоящей SCADA».

**Зафиксированные решения:**
- Режим монитора — **отдельный роут `/monitor`** (не тумблер в редакторе).
- Конфигурация биндинга — **JSON в существующем поле `script`** DTO (как `states[].image` — без изменения контракта).
- **Бэкенд дорабатываемый** — план включает полный список запросов к Java-команде (Раздел A, WP6).
- **Разделение труда**: `scripts` компонента — **Java, исполняются на сервере**; `bindings` — **JavaScript, исполняются на клиенте** движком режима монитора. Значения тегов прилетают по WS, JS-код биндинга решает, что делать: `if (LINE1FQT1.V > 100) { setState("Авария") } else { setState("Нормальное") }`.
- **Транспорт рантайма** (контракт от Java-команды, 15.07.2026): отдельный сервис на **`:8085`**, **raw WebSocket** (НЕ SockJS/STOMP) + сессионный хендшейк через REST. Полный контракт — в WP4; бэкендер обещал задокументировать его в `docs/MONITOR_CONTEXT.md` бэкенд-репозитория.

## Что уже есть (итог разведки, проверено по коду)

| Факт | Где |
|---|---|
| STOMP+SockJS клиент готов, но спит: `activate()` закомментирован; URL захардкожен `http://localhost:8080/ws`. ⚠ Этот стек — для **базы каналов** (`:8082`, топики `/topic/param/{id}` и др.); **монитор его НЕ использует** (см. WP4) | `src/shared/websocket/wsClient.ts`, `src/providers/WebSocketProvider.tsx` (в `src/app/layout.tsx`) |
| Единственный топик `/topic/device-tree/{site}/{project}` уже несёт `PARAM_UPDATED {key, value}` → патчит `useDeviceStore.params` | `src/shared/websocket/wsSubscriptions.ts` |
| `safeSubscribeDeviceTree` — единственный вызов `activate()`, **не импортируется нигде**; затирает `onConnect` (бага) | `src/lib/safeSubscribeDeviceTree.ts` |
| `bindings: unknown[]` — типа на клиенте нет; единственная форма — DTO `{component_property_id, name, script}` | `src/types/editorElement.type.ts:73`, `ComponentCreateDto:50` |
| Связь элемент→тег уже есть: `properties: PropertyCreateDto[]`, `tag_id` = точечный путь узла дерева устройств (выбор через `DeviceTreePanel` в `OpenChooseTagModal`) | `src/types/tags.types.ts`, `src/components/ui/OpenChooseTagModal.tsx` |
| Драйверы визуала готовы: `setCurrentComponentStateId(key, stateId)` — каскад по **имени** состояния (меняет только `currentComponentStateByElementKey`, НЕ `elements`); `updateElementsVisual` — пишет в overrides `elements` (⇒ попадает в undo и автосейв — для рантайма НЕ годится) | `src/store/useEditorStore.ts:594–707` |
| Флага read-only нет; `draggable` захардкожен в ~9 shape-файлах; `ctx` мемоизирован (`Canvas.tsx:346–356`), в deps уже есть `elementsMap` и `currentComponentStateByElementKey` | `src/components/editor/canvas/**` |
| Автосейв: `useAutoSaveScene` (60с, сравнение `elements` по ссылке) монтируется только в `EditorClient.tsx` | `src/lib/useAutoSaveScene.ts` |
| Виджеты управления (button/toggle/slider/dropdown/input) чисто визуальные — onClick только выделение | `src/components/editor/canvas/shapes/*` |

## Архитектурное ядро

**Живые данные никогда не трогают `elements`.** Рантайм пишет только в две неперсистируемые карты стора:
- `currentComponentStateByElementKey` (уже есть) — путь «переключение состояния»;
- `runtimeOverridesByElementKey: Record<elementKey, Record<prop, unknown>>` (новая) — путь «прямое изменение свойства».

Так как zundo настроен `partialize: {elements}` + `equality: a.elements === b.elements`, любой `set()`, не меняющий `elements`, **не создаёт записи undo**. Автосейв сравнивает `elements` по ссылке и вообще не монтируется в `/monitor`. Оба класса багов («рантайм засоряет undo», «живые значения сохраняются как дизайн») исключены **конструктивно**. `temporal.pause()` при входе в монитор — дополнительный ремень безопасности.

---

## WP1. Модель биндинга + round-trip (пункт роадмапа «движок» — фундамент)

**Новый файл `src/types/binding.types.ts`:**
```ts
export interface TagBinding {
  v: 1;                 // маркер схемы — по нему parse отличает «наши» биндинги
  id: string;           // createUuid()
  name: string;
  enabled: boolean;
  code: string;         // JavaScript-исходник; исполняется на клиенте движком монитора
  triggers?: string[];  // tag_id-ы-триггеры; не задано — любой тег из скоупа элемента
}
```

**Скоуп кода — свойства-теги элемента.** Мост «код ↔ теги» строится через `element.properties`
(`property_type === "Тег"`): имя каждого свойства становится переменной в скоупе биндинга —
`LINE1FQT1.V` означает «значение тега свойства с именем `LINE1FQT1`», а `tag_id` этого свойства
даёт ключ WS-подписки. Так биндинг не хранит путей тегов, переживает перепривязку тега внутри
свойства, а DTO-поле `component_property_id` остаётся осмысленным (id первого свойства-тега
элемента, иначе 0). Помимо тег-объектов в скоупе — API движка: `setState("Имя состояния")`,
`setProp("color", "#f00")`, `self` (rendered-снимок элемента, только чтение).

**Изменения:**
- `src/types/editorElement.type.ts:73` — `bindings: unknown[]` → `TagBinding[]` (все места инициализации уже `[]` — механически). Проверить baseline tsc (~10 ошибок) до/после.
- **Save** — `src/lib/buildComponentTree.ts` (`buildComponentNode`, стр. 107–116; зеркально `buildPaletteComponentTree` 172–178):
  `bindings: (element.bindings ?? []).map(b => ({ component_property_id: firstTagPropertyId(element) ?? 0, name: b.name, script: JSON.stringify(b) }))`.
  `buildShapeDescriptor` (стр. 45) уже кладёт `primitive.bindings` в дескриптор composition **сырыми объектами** — не трогать (там `TagBinding[]` запекается в `states[].image` напрямую).
- **Load** — `src/lib/transformElements.ts`: хелпер `parseBindings(raw: unknown[]): TagBinding[]` в **обоих** местах — стр. 170 (composition-дескриптор: объекты уже `TagBinding`, детект по `v`/`mode`) и стр. 199 (DTO-нода: `JSON.parse(script)`, принимать только с полем `v`). Легаси-мусор — drop c `console.warn`.
  ⚠ **Асимметрия**: top-level биндинги едут через DTO-обёртку, composition — сырыми. `parseBindings` обязан принимать обе формы. Дополнить существующий headless Node-чек round-trip'а сценой с биндингами на top-level компоненте И на composition-примитиве.
- **CRUD в сторе** (`useEditorStore.ts`): `addBinding(elementKey, binding)`, `updateBinding(elementKey, bindingId, patch)`, `removeBinding(elementKey, bindingId)` — через `elements.map(...)` (это design-time правки, они ДОЛЖНЫ попадать в undo, как правки скриптов/состояний).

**Гейт**: вопрос №2 Java-команде (см. WP6) — бэк не должен компилировать `bindings[].script` как Java.

**⚠ Обнаружено 16.07.2026 (реальный баг, не гипотеза)**: бэкенд ТРЕБУЕТ, чтобы `component_property_id` ссылался на существующее свойство ИМЕННО этого компонента — `0`/`null` → `400 "Binding requires component_property_id"`, id чужого компонента → `400 "Binding targets property N which does not belong to component M"`. Раз весь `POST /api/editor/components` — один атомарный запрос на всю сцену, попытка сохранить биндинг на элементе БЕЗ своего сохранённого свойства-тега рушит **весь сейв сцены целиком** (не только этот биндинг) — и ошибка тонет в сыром JSON-тосте (`Ошибка 400: {...}`), выглядя как «изменения не сохраняются». Исправлено: `hasSavedTagProperty()` (`src/lib/runtime/bindingScope.ts`) гейтит кнопку «Сохранить» в модалке биндинга и предупреждает в `BindingsTab`; `parseBackendErrorMessage()` в `exportScene` достаёт `message` из JSON-тела бэкенда вместо сырого блоба.

## WP2. UI создания биндингов (пункт «UI биндингов»)

- `src/components/editor/PropertiesPanel.tsx`: 5-я вкладка **«Привязки»** (расширить `TabType` стр. 21 и полосу вкладок ~274–292).
- Новые `src/components/editor/bindings/BindingsTab.tsx` + `BindingEditorModal.tsx` (паттерн `ModalRoot`/`Open*Modal`, образец — `OpenScriptEditorModal`, там уже CodeMirror):
  1. **Редактор кода** — CodeMirror с `@codemirror/lang-javascript` (добавить пакет; для Java-скриптов уже стоит `@codemirror/lang-java`).
  2. **Панель «Доступные теги»**: список свойств-тегов элемента (`property_type === "Тег"`), клик вставляет имя в код. Нет свойств-тегов → подсказка «Сначала добавьте свойство-тег на вкладке Свойства». Рядом — селект имён `element.states` со вставкой `setState("…")`.
  3. **Шаблон-заготовка** при создании: `if (ИМЯ.V > 100) { setState("Авария") } else { setState("Нормальное") }`.
  4. **Тест-прогон**: инпуты мок-значений для каждого тега скоупа → компиляция + выполнение (`executeBinding` из WP5) → показ результата (какие `setState`/`setProp` сработали) или ошибки с сообщением.
  5. В списке биндингов: name, тумблер `enabled`, индикатор последней ошибки исполнения (из рантайма).
- Валидация: имя свойства-тега должно быть валидным JS-идентификатором (кириллица допустима, пробелы/дефисы — нет); предупреждать при переименовании свойства, на имя которого ссылается код биндинга (поиск подстроки по `code`).

## WP3. Режим монитора `/monitor` (пункт «режим просмотра/рантайма»)

- `src/app/monitor/page.tsx` — `dynamic(() => import("./MonitorClient"), {ssr:false})` (паттерн `editor/page.tsx`).
- `src/app/monitor/MonitorClient.tsx`:
  - mount: `temporal.pause()`; unmount: `clearRuntime()` (новый экшен — чистит обе рантайм-карты) + `temporal.resume()` + закрыть WS (закрытия достаточно — сессия умирает на сервере сама, явный DELETE не нужен);
  - выбор сцены: переиспользовать ProjectModal → `loadSceneList` → `OpenChooseSceneModal` → `loadScene(id)`; рантайм-сессия открывается **на проект** (`projectId`) — при смене проекта пересоздаётся, при смене сцены внутри проекта живёт дальше;
  - тонкий тулбар «Проект»/«Сцена» + индикатор состояния соединения из `onStatus` WP4: `connecting` / `live` / `reconnecting` (реконнект = новая сессия, кратковременный жёлтый бейдж);
  - рендерит `<Canvas readOnly />`, вызывает `useRuntimeEngine(true)` (WP5);
  - **НЕ** монтирует `useAutoSaveScene`, `DndContext`, undo-хоткеи.
- `src/components/editor/HeaderNav.tsx`: пункт «Монитор» в `navItems`.
- **Протяжка `readOnly`**:
  - `Canvas.tsx`: проп `readOnly = false`; добавить в `EditorRenderContext` и deps `useMemo` (константа на маунт — мемоизацию не трогает). При `readOnly`: no-op `handleElementClick` (выделение не случается → все ручки/рамки сами скрываются), `useEditorHotkeys` c опцией `enabled: !readOnly`, `useStageInteractions` без маркиза (wheel-zoom и middle-mouse pan оставить), контекст-меню/hover/Transformer/мульти-drag — early-return.
  - `canvas/types.ts`: `readOnly` в `EditorRenderContext` **и** в `ShapeElementProps` (листовые компоненты не видят ctx — диспетчер `ShapeElement.tsx` передаёт вниз).
  - ~9 shape-файлов: `draggable={!ctx.readOnly}` вместо захардкоженного `draggable` — `ShapeElement.tsx` (generic ~298, polygon ~66, circle ~126, line ~189), `GroupNode.tsx:29` (+ гейт dblclick `enterGroup`), `Button/Toggle/Slider/Dropdown/InputShapeElement`, `TextShapeElement` (+ гейт dblclick редактирования текста).

## WP4. Транспорт рантайма: сессия + raw WebSocket на `:8085` (пункт «включить WS + подписка на значения»)

> Контракт получен от Java-команды 15.07.2026 (бэкендер задокументирует его в `docs/MONITOR_CONTEXT.md`
> бэкенд-репозитория). **Это НЕ SockJS/STOMP**: стек `wsClient.ts`/`stompjs` — для базы каналов (`:8082`),
> к монитору не подходит. Рантайм — отдельный сервис на `:8085`, голый `new WebSocket(...)` без брокера.

**Контракт (два шага, порядок обязателен):**
1. `POST /api/runtime/sessions` `{projectId}` → `{sessionId, wsPath, projectTree}`. REST идёт через gateway `:8080` (⇒ можно и через наш Next-BFF). `projectTree` — всё дерево проекта целиком; при реконнекте приходит новое.
2. `new WebSocket(RUNTIME_WS_ORIGIN + wsPath)`, где `wsPath = "/ws/runtime/{sessionId}"` — **только напрямую на `:8085`**: gateway роутит лишь `/api/**`, WS-upgrade через него не пройдёт. ⚠ Самая вероятная ошибка — склеить `wsPath` с origin gateway. WS без предварительного POST → close `1003 "Unknown runtime session"`.

**Формат сообщений:**
- Сервер → клиент, единственный тип, батч ~40мс:
  `{"type":"UPDATE","tags":[{tagId,value,ts}],"properties":[{propertyId,value}]}`.
  `tags[].value` — **всегда строка** (даже числа: `"42.7"`); `ts` — epoch ms; `tagId` — тот же `tag_id`, что в `properties[]` компонентов (маппинг тег↔компонент клиент строит сам). В одном батче может быть несколько апдейтов одного тега — брать последний (наш LWW-буфер это и делает).
- Клиент → сервер: `{"type":"ACTION","scriptId":123}` — триггер серверного Java-скрипта. **Ответ приходит сразу, минуя батч, и в нём `tags` = `null`, а не `[]`** — парсер обязан делать `msg.tags ?? []` / `msg.properties ?? []`. Неизвестные типы и битый JSON сервер молча игнорирует (⇒ клиентский ping безопасен).

**Свойства сессии:**
- **Обрыв WS убивает сессию** — реконнект на старый `wsPath` получит `"Unknown runtime session"`. Логика реконнекта обязана заново делать POST и брать новый `sessionId` (и новое дерево). Явный `DELETE /api/runtime/sessions/{id}` есть, но при обычном закрытии достаточно закрыть WS.
- **Auth на WS нет** — credential де-факто UUID сессии; origin любой, CORS не мешает. (POST через gateway — под обычным Bearer.)
- Второй коннект на тот же `sessionId` молча перезатрёт первый (нам не грозит: каждый POST = новая сессия).
- **Heartbeat не реализован** — при прокси между фронтом и `:8085` и редких тегах простой может оборвать соединение; клиентский ping (любой JSON, сервер проигнорирует) заложить сразу.

**Работа на фронте:**
- **Next-роут `src/app/api/runtime/sessions/route.ts`** — прокси `POST` на бэкенд через `protectedRoute` (паттерн остальных роутов; Bearer нужен именно на REST-шаге).
- **Новый `src/lib/runtime/runtimeConnection.ts`** — `openRuntimeConnection(projectId, {onUpdate, onStatus}): {close, sendAction}`:
  - POST через наш BFF → `WebSocket` на `NEXT_PUBLIC_RUNTIME_WS_URL ?? "ws://localhost:8085"` + `wsPath` (env в `.env.example`; **отдельная** переменная, не origin gateway);
  - `onmessage`: `JSON.parse` в try/catch, нормализация `tags ?? []` / `properties ?? []`, `onUpdate(tags, properties)`;
  - реконнект с бэкоффом (1с → 2с → … → 30с): закрытие → **новый POST** → новый WS; `onStatus("connecting" | "live" | "reconnecting")` для индикатора в тулбаре монитора;
  - клиентский ping `{"type":"PING"}` раз в ~20с;
  - `sendAction(scriptId)` — задел под виджеты управления (Phase C).
- **Отдельно от Фазы 4** (гигиена STOMP-стека базы каналов, по желанию): ref-counted `wsSubscribe` с единственным `onConnect` и переподпиской после reconnect; удалить мёртвый `safeSubscribeDeviceTree.ts`. Монитора не касается — можно делать в любой момент.

## WP5. Движок исполнения биндингов (пункт «движок» — драйвер данных)

**Стор:**
```ts
runtimeOverridesByElementKey: Record<string, Record<string, unknown>>;  // init {}
applyRuntimeBatch: (batch: {
  stateNameByKey?: Record<string, string>;               // elementKey → ИМЯ состояния
  propsByKey?: Record<string, Record<string, unknown>>;  // elementKey → патч свойств
}) => void;                                              // ОДИН set(); elements не трогает
clearRuntime: () => void;
```
- Каскад по имени вынести из `setCurrentComponentStateId` (594–634) в модульный хелпер `cascadeStateByName(elements, currentMap, rootKey, stateId)` — `applyRuntimeBatch` резолвит имена→id, каскадит по каждому корню, мёржит патчи и делает один `set()`. Если результат value-идентичен текущему — **`set()` не вызывается вовсе**.
- `src/lib/getRenderedElement.ts`: порядок мёржа `{...el, ...state.overrides, ...runtimeOverridesByElementKey[el.key]}` — рантайм выигрывает. Пустая карта в редакторе → ноль изменений поведения.
- `Canvas.tsx`: `runtimeOverridesByElementKey` в deps `ctx` (тот же контракт memo-bust, что и `currentComponentStateByElementKey`).

**Чистые модули:**
- `src/lib/runtime/bindingIndex.ts` — `buildBindingIndex(elements)` (раз на сцену, `useMemo` по identity `elements`; скипает `enabled: false`):
  1. для каждого элемента собирает скоуп — свойства-теги `{имя → tag_id}` (имена — невалидные JS-идентификаторы → skip + `console.warn`);
  2. **компилирует код один раз**: `new Function(...имена, "setState", "setProp", "self", binding.code)` → `CompiledBinding {elementKey, binding, fn, scopeTagIds}`; ошибка компиляции — биндинг помечается сломанным (показ в UI), в индекс не попадает;
  3. строит `Map<tagId, CompiledBinding[]>` по `scopeTagIds` (сужение по `triggers`, если заданы).
- `src/lib/runtime/executeBinding.ts` — чистый, тестируемый в Node, переиспользуется тест-прогоном в UI: `executeBinding(cb, valuesByTagId): BindingIntent[] | {error}`, где `BindingIntent = {kind:"state", elementKey, stateName} | {kind:"prop", elementKey, key, value}`. Строит тег-объекты `{V}` (`V` — число, если значение парсится, иначе строка; Phase B: `.RAW/.Q/.TS`), передаёт **коллекторы** `setState`/`setProp` (интенты копятся, последний вызов по цели выигрывает — стор напрямую скрипту недоступен), исполняет `fn` в `try/catch` — ошибка возвращается как результат и не роняет тик.
- `src/lib/runtime/useRuntimeEngine.ts` — `useRuntimeEngine(active: boolean)`: строит индекс, открывает `openRuntimeConnection(projectId, …)` (WP4), из `onUpdate` кладёт `tags[]` в коалесинг-буфер (`tagId` из сообщения === `tag_id` свойства — прямой ключ индекса; значение всегда строка — коэрция в `executeBinding`), тикает, применяет. `properties[]` (записи серверных Java-скриптов в свойства компонентов) в MVP логируются и игнорируются — обработка в Phase B (маппинг `propertyId → element.properties[].id`). Счётчик ошибок на биндинг: 5 подряд → автоотключение + индикация во вкладке «Привязки». **Сид начальных значений**: уточнить у бэка (вопрос №8 WP6), шлёт ли сервер полный срез значений первым UPDATE после коннекта — если нет, фолбэк `GET /api/device/fullHierarchy` → `params[].{key,value}` привязанных тегов первым тиком.

## WP6. Контракт исполнения скриптов (пункт «прояснить контракт») — вопросы Java-команде

Разделение труда зафиксировано: **`scripts` = Java, исполняются на сервере; `bindings` = JavaScript, исполняются на клиенте** (движок WP5). Контракт транспорта уже закрыл часть вопросов: серверный скрипт триггерится клиентом через `{"type":"ACTION","scriptId"}`, его записи в свойства компонентов прилетают как `properties[]` в UPDATE.

> **Проверено на живом стенде 16.07.2026**: №8 — среза НЕТ (WS молчит до первого изменения каждого
> тега — просить у бэка остаётся актуальным); №9 — `projectTree` = дерево editor-компонентов (тот же
> DTO, что `GET /scene/{id}`, у свойств есть `name`); №10 — теги кормит `scada-simulator` через Kafka
> `scada.tags` автоматически (публикация по изменению; в Kafka есть `quality:"GOOD"` — рантайм его
> отбрасывает); №11 — `projectId` = id проекта редактора (OpenAPI: «ID корневого компонента-проекта
> в editor»); №12 — сессия подписывается только на теги из свойств компонентов проекта (лог
> «started for project 911 (1 tags)»). Побочно найден баг бэка: `PUT /api/editor/properties/{id}` → 500.

Открытые вопросы:
1. Есть ли у Java-скриптов другие триггеры, кроме `ACTION` от клиента (изменение тега, таймер)? Какой движок исполняет?
2. **Бэк обязан хранить `bindings[].script` как опак-строку** (там будет JSON с JS-кодом внутри) — подтвердить, что поле не компилируется/не валидируется как Java. Если валидируется — просить nullable-колонку `config` или дискриминатор `binding_type`.
3. Какой API видит Java-скрипт (чтение/запись свойств, тегов, логирование)? `properties[].value` — «тип какой положил скрипт»: есть ли ограничения?
4. Песочница: SecurityManager устарел — GraalVM isolate / отдельный процесс / ограниченный classloader? Лимиты CPU/памяти/времени? Кто вправе писать скрипты?
5. Валидация при сохранении: возвращаются ли ошибки компиляции в ответе `POST /api/editor/components` и в каком формате (файл/строка/сообщение) — чтобы показывать их в CodeMirror-модалке?
6. Может ли серверный скрипт менять **состояние** компонента (в UPDATE есть только `tags`/`properties`)? Если появится — нужно правило приоритета с клиентскими биндингами.
7. Что должно делать поле `onChange` у свойства (`PropertyCreateRequestDto.onChange`)? Не это ли `scriptId` для `ACTION`?
8. **Шлёт ли сервер полный срез текущих значений первым UPDATE после коннекта?** Если нет — просить (иначе сцена «мертва» до первого изменения каждого тега; фолбэк `fullHierarchy` — см. WP5).
9. Что именно в `projectTree` ответа `POST /sessions` — дублирует ли `GET /api/editor/scene/{id}` (нужен ли он монитору вообще, или сцену продолжаем грузить своим REST)?
10. Чем кормить теги в dev-стенде (симулятор? правка параметра в базе каналов доходит до рантайм-сервиса?) — нужно для E2E-демо Phase A.

**Транспорт/семантика сессии (добавлено после получения контракта):**

11. **Что такое `projectId` в `POST /sessions`** — id проекта редактора (наш `currentProject.id`) или проект из дерева устройств (`site.project`)? Это первый параметр, который фронт передаст, — ошибиться нельзя.
12. **Скоуп подписки сессии**: сессия шлёт ВСЕ теги проекта или можно сузить? Сцена обычно использует малую долю тегов проекта — на больших проектах это лишний трафик и лишние прогоны нашего индекса. Если фильтра нет — просить опциональный `tagIds[]` в POST.
13. Если состав тегов меняется при живой сессии (добавили свойство-тег, сохранили сцену) — сессия подхватит новые теги или обязателен ре-POST? (Определяет, надо ли монитору пересоздавать сессию после «горячей» правки сцены.)
14. Сверка id-пространств: `properties[].propertyId` === `component_property_id` из editor-DTO? `scriptId` для `ACTION` === `scripts[].id` компонента? (Иначе фронту неоткуда взять значения.)
15. **Ошибки `ACTION`**: неизвестный/упавший `scriptId` — клиенту приходит что-то или тишина? Для optimistic-UX виджетов (Phase C) нужен хоть какой-то NACK.
16. Семантика `ts`: время источника или сервера? Гарантирован ли порядок элементов внутри батча? (Мы берём последний — важно, что «последний» = «новейший».)
17. **Потеря связи с устройством**: значения просто перестают приходить (quality в контракте нет)? Как монитору отличить «живой 0» от «устройство молчит» — иначе оператор видит устаревшие данные как актуальные. Минимум — договориться о «данные старше N сек = затемнять» на базе `ts`.
18. **Прод-топология `:8085`**: какой host/порт в проде, будет ли TLS (`wss://`), стоит ли прокси перед сервисом (тогда heartbeat критичен)? UUID сессии в URL попадает в логи прокси — планируется ли тикет/токен для прода?
19. Лимиты сессий: TTL простоя, максимум на пользователя (несколько вкладок монитора = несколько сессий — ок?), rate-limit на `POST /sessions` (реконнект-шторм всех клиентов после рестарта сервиса).

---

## Раздел A. Данные с бэкенда для корректной работы монитора

Контракт транспорта получен 15.07.2026 (детали в WP4) — таблица обновлена по факту:

| # | Данные | Статус | Транспорт |
|---|---|---|---|
| 1 | Дерево компонентов сцены с `states[].image`, `bindings`, `properties` (с `tag_id`) | **есть** — `GET /api/editor/scene/{id}`; плюс `projectTree` в ответе `POST /sessions` (что в нём — вопрос №9 WP6) | REST через Next-прокси |
| 2 | **Начальный снапшот текущих значений** привязанных тегов | **уточнить** — шлёт ли рантайм-сервис полный срез первым UPDATE (вопрос №8 WP6); фолбэк `fullHierarchy` | raw WS / REST |
| 3 | **Живой поток значений тегов** | **есть** — `{"type":"UPDATE","tags":[{tagId,value,ts}]}` с рантайм-сервиса `:8085`, сессия через `POST /api/runtime/sessions` | raw WS |
| 4 | Формат сообщения | **есть** — батчи ~40мс; `value` всегда строка, `ts` epoch ms; `properties[]` — записи серверных скриптов. `quality` в контракте НЕТ — попросить позже для затемнения плохих/устаревших данных (Phase B) | raw WS |
| 5 | Коалесинг на сервере | **есть** — батчинг ~40мс на сервере + наш LWW-буфер и тик 5 Гц поверх | — |
| 6 | Auth WS | **решено бэком: auth на WS нет**, credential = UUID сессии (URL-путь); Bearer нужен только на REST-шаге `POST /sessions` (идёт через наш BFF). Для прода стоит вернуться к вопросу (UUID в URL попадает в логи прокси) | — |
| 7 | Путь записи / команды оператора (Phase C) | **частично есть** — `{"type":"ACTION","scriptId"}` триггерит серверный скрипт (ответ мимо батча, `tags:null`!); прямой записи тега (`tag-write {key,value}`) в контракте нет — уточнить, нужна ли она или всё через скрипты | raw WS |
| 8 | Heartbeat | нет на сервере — клиентский ping закладываем сами (сервер молча игнорирует неизвестные типы) | raw WS |
| 9 | (Позже) метаданные тега: единицы, диапазоны, аварийные уставки | для трендов/аварийной стилизации | REST |

## Раздел B. Эффективное исполнение биндингов

Конвейер (весь внутри `useRuntimeEngine`):
1. **Компиляция + индекс** — раз на загрузку сцены: каждый биндинг компилируется в функцию через `new Function` (на горячем пути — только вызов, парсинга кода нет, исполнение — микросекунды), `Map<tagId, CompiledBinding[]>` даёт маршрутизацию входящего значения за O(1) независимо от размера сцены.
2. **Коалесинг-буфер** `pending: Map<tagId, string>` — last-write-wins на тег: тег на 100 Гц схлопывается ровно в одну оценку за тик; всплеск в 500 тегов — одно заполнение карты.
3. **Тик** `setInterval(flush, 200)` (5 Гц). Именно interval, а не rAF: rAF замерзает в фоновых вкладках (значения копились бы без применения); затроттленный до 1 Гц фоновый interval для монитора нормален. Плюс flush по `visibilitychange` для мгновенного догона при возврате на вкладку.
4. **Отсечение no-op**, три слоя: `lastSeen: Map<tagId, string>` (то же сырое значение → пропуск оценки); после оценки — резолвнутый state id равен текущему / значение свойства равно текущему override → intent отбрасывается; пустой набор intents → **`set()` не вызывается** (ноль работы React).
5. **Один `set()` за тик** через `applyRuntimeBatch` — одно уведомление стора, одна пересборка ctx, одна отрисовка слоя Konva, сколько бы тегов ни изменилось.
6. **Изоляция сбоев**: каждый вызов скомпилированной функции — в `try/catch`; интенты собираются коллекторами `setState`/`setProp`, прямого доступа к стору у скрипта нет; 5 ошибок подряд → автоотключение биндинга (см. также Риски №10).

**Стоимость двух путей** (проверено по `Canvas.tsx:346–356` — обе карты в deps ctx):
- *State-switch*: резолв имя→id + каскад O(поддерева); `elements` не меняется → ни undo, ни `recomputeAncestorBounds`. Рендер: новая identity карты **сбрасывает React.memo всей сцены** (потом react-konva диффит дёшево).
- *Property-write*: O(1) мёрж карты, та же цена рендера через новый dep `runtimeOverridesByElementKey`.

**Оценка memo-bust**: с батчингом это максимум **один полный shallow-ре-рендер сцены в 200 мс**, и только на тиках с реальными изменениями. Для реалистичных сцен (< ~500 листьев) — в бюджете (то же самое уже происходит при каждом ручном переключении состояния). **Принять для MVP.** Митигация при тормозах (Phase C, механическая): вынести обе карты из deps ctx и дать `ShapeElement`/`GroupNode` локальные zustand-подписки `s => s.…[el.key]` (паттерн «ручки подписаны на `camera.zoom` локально») — тогда тик ре-рендерит только затронутые фигуры.

## Порядок реализации

**Phase A — MVP, живые данные end-to-end (демонстрируемо):**
WP1 (типы + round-trip + CRUD) → WP4-минимум (Next-прокси `POST /api/runtime/sessions`, `runtimeConnection.ts` с реконнектом и ping) → WP5-минимум (компиляция + движок, **только `setState`**, `properties[]` игнорируются) → WP3 (`/monitor` + `readOnly`) → WP2-минимум (вкладка «Привязки», JS-редактор + тест-прогон).
**Демо**: создать биндинг в редакторе → сохранить → `/monitor` → изменение значения тега (источник в dev — вопрос №10 WP6: симулятор или правка параметра) → компонент живьём переключается «Нормальное» → «Авария». Бэкенд-часть транспорта уже реализована — доработки бэка для среза не нужны.

**Phase B:** `setProp` (рендер-путь `runtimeOverridesByElementKey`); обработка `properties[]` из UPDATE (записи серверных скриптов: маппинг `propertyId → element.properties[].id`, значения не-тег-свойств в скоупе биндингов); `.TS`/`.RAW` в тег-объектах; сид начальных значений (по ответу на вопрос №8); quality — если бэк добавит.

**Phase C:** команды оператора с виджетов управления (`sendAction(scriptId)` + optimistic/ack UX; прямая запись тега — по ответам WP6); перф-оптимизация локальными подписками; Web Worker для биндингов (риск №10).

## Риски

1. `bindings: unknown[] → TagBinding[]` и правки `transformElements.ts` (там baseline-ошибки tsc) — проверить, что счётчик остался ~10.
2. **Асимметрия round-trip** (DTO-обёртка vs сырые composition-биндинги) — `parseBindings` принимает обе формы + расширенный headless-чек.
3. Бэк может компилировать `bindings[].script` как Java → вопрос 2 WP6 гейтит кодирование; фолбэк — колонка `config`.
4. **`wsPath` склеен с origin gateway** — gateway роутит только `/api/**`, WS молча не подключится. Отдельная env `NEXT_PUBLIC_RUNTIME_WS_URL` (`ws://localhost:8085`), никогда не выводить её из URL API. (Бэкендер: «самая вероятная ошибка».)
5. **Реконнект на старый `sessionId`** → `1003 "Unknown runtime session"`: обрыв убивает сессию на сервере. Реконнект = новый POST + новый WS; наивный retry на тот же URL уйдёт в вечный цикл ошибок.
6. Общий стор между роутами: рантайм-карты чистить на unmount монитора; `temporal.pause()/resume()` скобками; после правок стора — полный reload страницы (zundo не переживает Fast Refresh).
7. Строковые значения тегов vs числовые сравнения в JS-коде — **подтверждено контрактом**: `tags[].value` всегда строка, даже для чисел (`"42.7"`). Коэрция в `executeBinding`: `.V` отдаёт число, если значение парсится, иначе строку (иначе `"9" > "10"` сравнивалось бы лексикографически).
8. Смена порядка мёржа в `getRenderedElement` глобальна — редактор обязан не измениться (пустая карта); санити-чек: загрузить сцену, попереключать состояния.
9. Переименование свойства-тега ломает ссылающийся на него код биндинга (переменная исчезает из скоупа) — предупреждение в UI при переименовании (WP2); перепривязка `tag_id` внутри свойства безопасна (код ссылается на имя).
10. Пользовательский JS на main thread: `new Function` — не песочница (авторы — те же доверенные инженеры, что пишут Java-скрипты в существующем редакторе); бесконечный цикл повесит вкладку, таймаут на main thread не навязать. Митигация Phase C — Web Worker (значения внутрь, интенты наружу). `try/catch` + автоотключение после N ошибок — уже в MVP.
11. **`tags: null` в ответах на ACTION** (не `[]`) — нормализация `msg.tags ?? []` в `runtimeConnection` обязательна, иначе первый же ACTION уронит парсер.
12. Нет heartbeat на сервере: при прокси и редко меняющихся тегах соединение может тихо оборваться — клиентский ping с самого начала + реконнект-детект по `close`.
13. Ошибочное переиспользование STOMP-клиента базы каналов для монитора (соблазн «WS уже есть») — транспорты разные принципиально: `:8082` SockJS+STOMP vs `:8085` raw WS; в коде монитора `wsClient.ts` не импортировать.

## Верификация (для сессий реализации)

- **Round-trip**: существующий headless-чек (транспиляция `buildComponentTree`/`transformElements`/`createUuid` через `npx tsc --module commonjs` + Node-скрипт) + сцена с биндингами на top-level и composition-уровне.
- **executeBinding**: компиляция + прогон таблицы случаев (числовые/строковые сравнения, коллекторы `setState`/`setProp`, «последний вызов выигрывает», ошибка исполнения, невалидный код, коэрция `.V`) тем же headless-способом в Node.
- **tsc-baseline**: `tsc --noEmit` до/после — не больше ~10 ошибок.
- **runtimeConnection**: подключение без POST → close 1003 (негативный тест руками через консоль); нормализация `tags ?? []`; реконнект после `kill` соединения → новый sessionId и продолжение потока.
- **E2E вручную**: `npm run dev` → создать биндинг в редакторе → сохранить → открыть `/monitor` → изменить значение тега (источник в dev — вопрос №10 WP6) → увидеть живое переключение состояния; проверить, что в мониторе нет выделения/drag/меню, а Ctrl+Z после возврата в редактор не содержит рантайм-шагов.
