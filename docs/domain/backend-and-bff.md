# Backend, BFF и соединения браузера

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Backend & data flow

This is a **frontend + BFF**, not a standalone app. Everything under `src/app/api/**/route.ts` is a thin proxy to a separate (Java/Spring) backend:

- `BACKEND_URL_EDITOR` (default `http://localhost:8080`) — editor/scene/component APIs.
- `BACKEND_URL` — device/channel APIs.
- Auth: `protectedRoute` (`src/server/auth/protected.ts`) reads the `access_token` httpOnly cookie and forwards it as `Authorization: Bearer …`. Wrap every backend-touching route with it.
- The cookie's `Secure` flag follows the **request's protocol** (`isHttpsRequest` in `src/server/auth/setTokenCookies.ts`, honours `x-forwarded-proto`), never `NODE_ENV`: the stand and the Docker package are production builds served over http, where a `Secure` cookie is silently dropped for anything but `localhost`. Login and logout must set the same attributes, or the logout cannot overwrite it.

## Sessions: access + refresh (contract `docs/contract/2026-10-28-auth-sessions-contract.md`)

- **Two httpOnly cookies, both `Path=/`**: `access_token` (`maxAge` from the JWT `exp`) and
  `refresh_token` (`maxAge` = `refreshExpiresIn`, 7 days from the last rotation). Set and cleared only
  through `setSessionCookies` / `clearSessionCookies` (`setTokenCookies.ts`), so login, refresh and
  logout always agree on attributes. The browser never sees the refresh token — not in JS, not in a body.
  A backend that returns no `refreshToken` keeps the old access-only behaviour.
- **Only the BFF refreshes** (`src/server/auth/sessionRefresh.ts`, `resolveSession`): when
  `access_token` is missing or expires within 60 s and `refresh_token` exists, both `protectedRoute`
  (on `/api/*`) and `src/proxy.ts` (page navigations) rotate the pair via `POST /api/auth/refresh`.
  `proxy.ts` writes the new cookies to the **request** too — server components of the same render
  (`getUser`) read request cookies. 401 → both cookies cleared, `protectedRoute` answers 401
  (`authInterceptor` goes to `/login`), `proxy` redirects to `/login`. An auth outage is *not* a logout:
  the old access token (if any) is used, otherwise `protectedRoute` answers 503.
- **One rotation per refresh token**: presenting a spent refresh token is treated as theft by the
  backend (the whole chain dies). `refreshSession` keeps a module-level `Map<refreshToken, Promise>`
  and shares the result for 20 s, so parallel requests and tabs get the same new pair. The backend
  also tolerates reuse within 30 s, which covers `proxy` and routes not sharing the map. Retrying a
  backend 401 on a not-yet-expired token is not implemented (optional in the contract).
- **`/login` counts as "logged in" with either cookie**; dead cookies are always cleared before
  redirecting to `/login`, otherwise the two redirects would loop.
- **Logout** (`/api/auth/logout`) sends `refresh_token` to the backend (errors swallowed) and clears
  both cookies. Already issued access tokens live until `exp`; only "end sessions" in the admin
  (`revoke-sessions`), a password change/reset or disabling the user kills them at once.
- **Login 429**: 10 failed attempts per login in 15 minutes lock it until the window ends;
  `login/route.ts` turns `Retry-After` into «Слишком много неудачных попыток, повторите через N мин.».
- **Monitor WebSocket uses a one-time ticket**, not the JWT: `/api/runtime/sessions` fetches
  `POST /api/auth/ws-ticket` (30 s, single use, not valid for REST) and returns `{...session, ticket}`;
  `runtimeConnection` opens `wsPath?ticket=…`. A new session (and ticket) is created on every
  (re)connect. No ticket → 503, the monitor retries.
- **Editor STOMP** still authenticates by the `access_token` cookie (same host as the gateway).
  `beforeConnect` calls `POST /api/auth/refresh` (BFF, 204, cookies only) before every (re)connect,
  so a page idle longer than the token lifetime does not reconnect with an expired cookie.
- Site keys after this frontend is deployed: `JWT_EXPIRATION_MS=28800000` (auth),
  `GATEWAY_WS_QUERY_TOKEN_ENABLED=false` (gateway). Do not enable them for an older frontend.

**Browser-side connections** (monitor WebSocket, editor STOMP) go to the gateway directly, not through
the BFF: `src/lib/gatewayOrigin.ts` builds the origin from the **page's hostname** + port 8080
(`NEXT_PUBLIC_GATEWAY_PORT` / `_GATEWAY_URL` / `_RUNTIME_WS_URL` only override — they are baked in at
build time and the Docker image is shared by all installs). Never hard-code `localhost` there: from
another machine it is the client itself, and the `access_token` cookie is shared by host, not port.
Call it at connect time, never at module level (SSR has no `window`).

Three product areas share the app: **editor** (`/editor`, the SCADA scheme editor — the core of this repo), **channels/devices** (`/channels`, device hierarchy + tags), **logs** (`/log`). Stores live in `src/store/` (one Zustand store per area).
