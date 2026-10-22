# Backend, BFF и соединения браузера

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Backend & data flow

This is a **frontend + BFF**, not a standalone app. Everything under `src/app/api/**/route.ts` is a thin proxy to a separate (Java/Spring) backend:

- `BACKEND_URL_EDITOR` (default `http://localhost:8080`) — editor/scene/component APIs.
- `BACKEND_URL` — device/channel APIs.
- Auth: `protectedRoute` (`src/lib/protected.ts`) reads the `access_token` httpOnly cookie and forwards it as `Authorization: Bearer …`. Wrap every backend-touching route with it.
- The cookie's `Secure` flag follows the **request's protocol** (`isHttpsRequest` in `src/lib/setTokenCookies.ts`, honours `x-forwarded-proto`), never `NODE_ENV`: the stand and the Docker package are production builds served over http, where a `Secure` cookie is silently dropped for anything but `localhost`. Login and logout must set the same attributes, or the logout cannot overwrite it.

**Browser-side connections** (monitor WebSocket, editor STOMP) go to the gateway directly, not through
the BFF: `src/lib/gatewayOrigin.ts` builds the origin from the **page's hostname** + port 8080
(`NEXT_PUBLIC_GATEWAY_PORT` / `_GATEWAY_URL` / `_RUNTIME_WS_URL` only override — they are baked in at
build time and the Docker image is shared by all installs). Never hard-code `localhost` there: from
another machine it is the client itself, and the `access_token` cookie is shared by host, not port.
Call it at connect time, never at module level (SSR has no `window`).

Three product areas share the app: **editor** (`/editor`, the SCADA scheme editor — the core of this repo), **channels/devices** (`/channels`, device hierarchy + tags), **logs** (`/log`). Stores live in `src/store/` (one Zustand store per area).
