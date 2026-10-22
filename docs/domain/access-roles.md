# Права доступа

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Access roles: hide what the backend will refuse

Contract: `docs/contract/2026-10-15-access-roles-contract.md` (with a «Уточнения» section verified
against the backend). Per project a user has `view` / `operate` / `edit` + a level 1–10 (only with
`operate`); admins can do everything at level 10. **The backend refuses on its own** — every check
here is convenience, never protection.

- **Where rights come from.** `EditorProject.access` from the project list (the list itself only
  contains projects with at least one right; admins get full `access`). `grantOf(project, admin)`
  (`lib/access/grants.ts`) is the only reader; hooks `useCurrentProjectGrant` /
  `getCurrentProjectGrant` live in `lib/access/projectAccess.ts`. The admin flag is the JWT claim,
  decoded server-side in `(app)/layout.tsx` and handed to `useSessionUserStore` by
  `SessionUserBootstrap` (the cookie is httpOnly). Rights change without a new token — never
  read them from the token.
- **Denial bodies** are `{error: "FORBIDDEN", reason, requiredLevel?}` with no `message`;
  `describeDenial` / `errorTextFromBody` / `errorTextFromJson` (`lib/access/accessErrors.ts`)
  translate them. Any new fetch error path must go through them or the toast shows «FORBIDDEN».
  `ACCESS_NOT_READY` (403) means "server is starting" — retry, not a denial.
- **Global logout**: `authInterceptor.ts` wraps `window.fetch` at module load (in `providers.tsx`,
  not an effect — child effects run first) and sends any 401 / 403 `USER_DISABLED` from `/api/*`
  to `/login`. Login/logout routes are exempt.
- **Editor, `view` without `edit`**: local editing and undo stay; everything that writes is hidden
  (`canWrite` in `ToolsPanel`, separate from the existing `canEdit`) **and** refused in the store
  by `canWriteCurrentProject()` — `exportScene` (autosave silently), restore, create/delete scene,
  pins, the saved-property rename PUT. Operate-only projects are not shown in the editor/data/
  automation pickers and are reset on entering the editor.
- **Script `access_level`** rides as `ElementScript.accessLevel` through the same whitelists as
  `displayed` (`transformElements` ×2, `buildComponentTree` scene + palette); composition
  descriptors and `instantiateTemplate` copy scripts whole. Losing it silently makes the script
  level 1 — the backend cannot notice.
- **Monitor actions**: `runScriptOn` in `useRuntimeEngine` is the single refusal point — an `onClick`
  calls `runScript(name)` from JS, so the button cannot be disabled ahead of time. Without
  `operate` or below the level, no `ACTION` leaves and `showRuntimeNotice` draws the reason at the
  click point (`RuntimeNoticeLayer`); a server `ACTION_DENIED` lands at the same point
  (`actionPointsRef`, keyed by script id). Menu items get the reason via `unavailableReason`.
  «Опции» and the inspector need `operate` + level ≥ 9 (`canWriteDirectly`).
- **Monitor WS close codes**: `4403` → status `revoked` (no reconnect, back to the project list),
  `1008` → `rejected`, `1013` → reconnect after 4 s; `POST /sessions` 403 is terminal except
  `ACCESS_NOT_READY`.
- **Procedure levels** come from prod via `GET /api/runtime/projects/{id}/procedure-levels`
  (`useProcedureLevels` in `src/modules/monitor`, TanStack Query keyed by project and
  `releaseVersionNo`, so a new release re-reads them; any failure means empty levels = 1); `useProcedureControls().denied[op]` disables the buttons. The editor's
  `/api/editor/projects/{id}/procedure-levels` is the *draft* — it reaches the monitor only with a
  new prod release, like script levels.
- `tags/write` always carries `projectId` (400 without it); the backend writes only tags of that
  project's prod release.
