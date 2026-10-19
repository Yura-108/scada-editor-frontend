# Контракт: флаг `Secure` у cookie `access_token` — по протоколу запроса

> 19.10.2026. Только фронт (`scada-editor-frontend`, ветка `nextjs`); бэкенда правка не касается.
> Задача — scada-6yyn (вход по http с другого компьютера невозможен). Кратко то же — п. 5
> `2026-10-16-frontend-open-tasks.md`. Места в коде проверены по рабочей копии фронта на 19.10.2026
> (последний коммит `88a737f`).

## Что сломано

С другого компьютера сети войти нельзя: открываешь `http://<IP сервера>:3000`, вводишь логин и
пароль, `POST /api/auth/login` отвечает `200`, но страница тут же уводит обратно на `/login`.

Причина — cookie `access_token` ставится с флагом `Secure` всегда, когда фронт собран для production:

```ts
// src/lib/setTokenCookies.ts:32 и src/app/api/auth/logout/route.ts:11
secure: process.env.NODE_ENV === 'production',
```

Стенд (`start-all`) и Docker-пакет запускают именно production-сборку (`next start`), и по **http**.
Браузер принимает cookie с `Secure`, пришедшую по http, только для `localhost`. С самой машины
сервера поэтому всё работает, а по IP или имени хоста cookie молча отбрасывается — следующий запрос
идёт без токена, и BFF отправляет на `/login`.

Флаг `Secure` должен зависеть от того, по какому протоколу пришёл **этот** запрос, а не от того, как
собран фронт.

## Что сделать

### 1. Общая функция «запрос пришёл по https?»

Например, в `src/lib/setTokenCookies.ts`:

```ts
/** Запрос пришёл по https: напрямую или через обратный прокси, который выставил x-forwarded-proto. */
export function isHttpsRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  return new URL(request.url).protocol === 'https:';
}
```

- `x-forwarded-proto` — когда перед фронтом стоит обратный прокси с TLS (nginx, IIS): сам Next тогда
  видит http, а браузер — https. Берётся первое значение: прокси могут дописывать через запятую.
- Без заголовка — протокол URL запроса.

### 2. Вход: `setTokenCookie` получает запрос

```ts
// src/lib/setTokenCookies.ts
export function setTokenCookie(token: string, request: Request) {
  ...
  secure: isHttpsRequest(request),
```

Вызов — `src/app/api/auth/login/route.ts:17`: `return setTokenCookie(token, request);`
(`request` в `POST(request: Request)` уже есть).

### 3. Выход: те же флаги

`src/app/api/auth/logout/route.ts` — `POST(request: Request)` и `secure: isHttpsRequest(request)`.
Cookie удаляется только с теми же атрибутами, с какими ставилась; иначе браузер её не перезапишет.

Остальные атрибуты (`httpOnly`, `path: '/'`, `sameSite: 'lax'`, `maxAge` из `exp` токена) не менять.

## Безопасность

- По https флаг `Secure` по-прежнему ставится: cookie не утечёт в открытый http.
- По http cookie без `Secure` — так же, как сейчас при `next dev`. На стенде и в пакете без TLS
  другого способа нет: токен и так идёт по сети открытым текстом в теле ответа входа.
- Подделать `x-forwarded-proto` клиентом можно, но это лишь снимет или поставит флаг на своей же
  cookie — чужого он этим не получит.

## Чего контракт не меняет

- Бэкенд и gateway: gateway читает тот же `access_token` из cookie для STOMP `/ws/editor`
  (`JwtAuthenticationFilter`), имя и формат cookie прежние.
- `next dev` — поведение то же (раньше `Secure` там и так не ставился).

## Проверить

1. Стенд (`start-all`, production-сборка фронта). С **другого** компьютера открыть
   `http://<IP сервера>:3000`, войти — попасть на `/channels` и остаться там после перезагрузки
   страницы.
2. В DevTools → Application → Cookies: `access_token` есть, `HttpOnly` — да, `Secure` — нет.
3. Выйти — cookie пропала, `/channels` уводит на `/login`.
4. Если есть обратный прокси с TLS: войти по `https://…` — у cookie `Secure` = да.
