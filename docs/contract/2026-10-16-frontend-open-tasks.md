# Открытые задачи фронта — сверено с кодом 16.10.2026

> Бэкенд по всем четырём пунктам готов или не нужен — дело только во фронте
> (`scada-editor-frontend`, ветка `nextjs`). Места в коде проверены по рабочей копии на 16.10.2026.
> Задачи в beads остаются открытыми, пока фронт не сделал.

| # | Задача | Приоритет | Коротко |
|---|---|---|---|
| 1 | `scada-wr9r` | P2 | Браузерный код ходит на `localhost:8080` — с другого компьютера монитор и каталог не работают |
| 2 | `scada-9he6` | P2 | Панель рецептов при ошибке загрузки бесконечно перезапрашивает |
| 3 | `scada-fxw1.2` | P3 | Нет подписки на `SCENE_CHANGED`; STOMP каталога мёртв с обеих сторон |
| 4 | `scada-fxw1.1` | P4 | Мёртвые BFF-роуты на несуществующий `/api/channel/node/all` |

Самое важное — п. 1: без него систему нельзя открыть ни с одного компьютера, кроме сервера.

---

## 1. Адрес gateway зашит как `localhost` (`scada-wr9r`)

**Что сломано.** Браузер подключается к gateway по фиксированному `localhost:8080`. На машине, где
крутится сервер, это работает; с любого другого компьютера сети `localhost` — это сам клиент, и
WebSocket монитора и STOMP каталога не подключаются (страницы открываются — REST идёт через BFF Next).

**Где.**

```ts
// src/lib/runtime/runtimeConnection.ts:126
const RUNTIME_WS_ORIGIN =
  process.env.NEXT_PUBLIC_RUNTIME_WS_URL ?? "ws://localhost:8080";
```

`NEXT_PUBLIC_*` вшивается при **сборке**: Docker-образ фронта один на все установки, адрес
сервера заранее неизвестен.

```ts
// src/shared/websocket/wsClient.ts:7
new SockJS("http://localhost:8080/ws", null, { withCredentials: true } as any),
```

BFF-роуты (`src/app/api/**`, `src/lib/*Proxy.ts`) с `process.env.BACKEND_URL || 'http://localhost:8080'`
трогать **не нужно**: они исполняются на сервере Next, в Docker-пакете там `http://gateway:8080`.

**Как устроено у нас.** Фронт (`:3000`) и gateway (`:8080`) — разные порты одного хоста, общего
обратного прокси нет (`docker-compose.yml`: `frontend` 3000, `gateway` 8080).

**Что сделать.** Брать хост из адреса страницы, порт gateway — 8080, переменная — только чтобы
переопределить:

```ts
// src/lib/gatewayOrigin.ts — один источник для обоих клиентов
const GATEWAY_PORT = process.env.NEXT_PUBLIC_GATEWAY_PORT ?? "8080";

/** Origin gateway в браузере: тот же хост, что у страницы, порт gateway. */
export function gatewayHttpOrigin(): string {
  if (process.env.NEXT_PUBLIC_GATEWAY_URL) return process.env.NEXT_PUBLIC_GATEWAY_URL;
  return `${window.location.protocol}//${window.location.hostname}:${GATEWAY_PORT}`;
}

export function gatewayWsOrigin(): string {
  if (process.env.NEXT_PUBLIC_RUNTIME_WS_URL) return process.env.NEXT_PUBLIC_RUNTIME_WS_URL;
  const ws = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${ws}//${window.location.hostname}:${GATEWAY_PORT}`;
}
```

- `runtimeConnection.ts`: `RUNTIME_WS_ORIGIN` вычислять при подключении (`gatewayWsOrigin()`), а не
  на уровне модуля — модуль может импортироваться при SSR, где `window` нет.
- `wsClient.ts`: `new SockJS(\`${gatewayHttpOrigin()}/ws\`, …)` внутри `webSocketFactory` (он
  вызывается в браузере при `activate()`).
- Хост — **именно `hostname` страницы**, не IP и не `localhost`: токен STOMP едет в cookie
  `access_token`, cookie привязаны к хосту (порт не учитывается), поэтому `host:3000` и `host:8080`
  её делят, а `localhost` против `192.168.x.x` — нет.

**Проверить.** Открыть фронт с другого компьютера по `http://<IP сервера>:3000`: монитор
показывает «Живые данные», в DevTools → Network → WS соединения идут на `<IP сервера>:8080`.

---

## 2. Бесконечная перезагрузка рецептов при ошибке (`scada-9he6`)

**Что сломано.** Любая ошибка загрузки рецептов (5xx, сеть) сбрасывает `loaded`, эффект в
компоненте тут же зовёт загрузку снова — цикл запросов и поток тостов «Ошибка загрузки рецептов».

**Где.**

```ts
// src/store/useRecipeStore.ts:46
loadRecipes: async () => {
  set({isLoading: true, loaded: true});
  try { … } catch (err) {
    report(err, "Ошибка загрузки рецептов");
    set({recipes: [], loaded: false});      // ← возвращает флаг, и эффект зовёт снова
  } …
}
```

Вызывают по `if (!loaded) void loadRecipes();`: `components/editor/panels/RecipesPanel.tsx:58`,
`components/monitor/ProcedureHud.tsx:53`, `components/monitor/ProcedurePanel.tsx:37`.

Случай 401 с 15.10.2026 закрыт общим перехватом (`authInterceptor.ts` уводит на `/login`), но
на 5xx и обрыве сети цикл остаётся.

**Что сделать.** Ошибку хранить отдельно и не сбрасывать `loaded`:

```ts
loadRecipes: async () => {
  set({isLoading: true, loaded: true, loadError: null});
  try { … } catch (err) {
    report(err, "Ошибка загрузки рецептов");
    set({recipes: [], loadError: err instanceof Error ? err.message : "Ошибка загрузки рецептов"});
  } finally { set({isLoading: false}); }
},
```

Повтор — по кнопке «Повторить» в панели (зовёт `loadRecipes()` явно). Эффекты `if (!loaded)` не
менять.

---

## 3. `SCENE_CHANGED` и STOMP каталога (`scada-fxw1.2`)

### 3.1. Сохранение сцены другим инженером

**Что есть на бэке (с 25.09.2026).** После коммита новой версии сцены `editor` шлёт по STOMP:

- эндпоинт SockJS `/ws/editor` через gateway (`:8080`), токен — cookie `access_token`, как у `/ws`;
- тема `/topic/scenes/{sceneId}`, тело:

```json
{ "type": "SCENE_CHANGED", "scene_id": 12, "version_no": 44, "user_name": "ivanov" }
```

Это уведомление, не синхронизация: правки в открытый редактор сами не подмешиваются.

**Что сломано.** На фронте нет ни клиента `/ws/editor`, ни подписки. Второй инженер узнаёт о
чужом сохранении только при своём — слиянием или конфликтом `409`.

**Что сделать.**

- Отдельный `Client` на `${gatewayHttpOrigin()}/ws/editor` (п. 1), подписка на
  `/topic/scenes/{sceneId}` при открытии сцены в редакторе, отписка при уходе.
- Своё сохранение отсеять: `version_no` из сообщения равен версии, которую вернул наш `PUT`.
- Чужое — плашка «Сцену сохранил {user_name}, версия {version_no}» с кнопкой «Перезагрузить»
  (тот же путь, что открыть сцену заново; при несохранённых правках — предупредить, как при
  переходе на другую схему).
- В режиме просмотра версии (`versionPreview`) — только плашка, без перезагрузки.

### 3.2. STOMP каталога каналов `/ws` — решить, нужен ли

Сейчас он мёртв с обеих сторон:

- фронт подписан на `/topic/device-tree/{site}/{project}` (`src/shared/websocket/wsSubscriptions.ts`),
  а `channel` такую тему **не шлёт**;
- `channel` шлёт только `/topic/param/{paramId}` (тело — новое `value` строкой, после
  `PATCH /api/channel/param/update`), а на неё никто не подписан.

Варианты: подписаться на `/topic/param/{id}` для открытых в каталоге параметров, либо убрать
STOMP каталога целиком (клиент `wsClient.ts`, `wsSubscriptions.ts`) — тогда и бэкенд уберёт
рассылку. Нужен ответ фронта; бэкенд подстроится.

---

## 4. Мёртвые BFF-роуты (`scada-fxw1.1`)

**Где.** `src/app/api/device/route.ts` (GET, строка ~16) и `src/app/api/project/route.ts`
(строка ~15) проксируют на `GET /api/channel/node/all?site=&project=`. В `channel` такого
эндпоинта нет (`NodeController`: `fullHierarchy`, `hierarchy`, `sites`, `templates`) — ответ был бы
`404`. Вызовов этих роутов из клиента нет.

**Что сделать.** Удалить оба роута (или только их GET, если в файле есть другие методы).
