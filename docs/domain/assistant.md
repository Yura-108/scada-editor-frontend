# Помощник редактора (тестовая функция)

> Контракт: `docs/contract/2026-11-02-assistant-frontend-contract.md`. Бэкенд — ветка
> `feat/assistant-service` репозитория `scada-editor-backend`; фронт — ветка `feat/assistant-panel`,
> в `dev` её вливают только после того, как сервис попадёт в `dev` бэкенда.

## The one rule: the assistant only proposes

The service (a local model) never saves anything and never writes to a PLC. Every answer lands
in front of a person first; what they accept goes into the scene document and reaches the server
through the **normal scene save** (`based_on_version`), so version history and releases work as
before. Never wire an assistant answer straight into the store, the save path or `tag_id`.

## Where it lives

- **BFF:** `src/app/api/assistant/projects/[projectId]/{scripts/generate,scripts/edit,tags/resolve,scenes/plan}/route.ts`
  — thin `protectedRoute` proxies over `server/proxy/assistantProxy.ts` (path whitelist, body as is,
  no `X-Username`). **No timeout on purpose:** the server waits up to 120 s per model call and
  `scripts/edit` makes one call per script. Backend unreachable → `503` like the service's own.
- **Client:** `modules/editor/api/assistant.ts` — one `useMutation` per endpoint; `assistantErrorText`
  maps `400/401/403/502/503`. `503` is a normal state (model not running): show «Помощник сейчас
  недоступен», the editor keeps working. Types — `modules/editor/types/assistant.types.ts`.
- **Access:** `ui/assistant/useAssistantAccess` — scene of the current project, no version preview,
  `edit` right (`useToolbarAccess().canSave`). Without it every assistant block renders nothing.
- **Channel root:** the project ↔ channel base link is stored nowhere, so `channel_root` is picked per
  request with `ui/project/ChannelRootPicker` + `useChannelRoot` (shared with autobind).

## Script draft — `scripts/generate`

`ui/assistant/AssistantScriptDraft`, a collapsed «Помощник» block above the code field. `kind` comes
from the place, never from the user:

| Editor | `kind` |
|---|---|
| server scripts, `OpenScriptEditorModal` | `ACTION` |
| event handlers, `OpenEventScriptModal` | `ON_CLICK` (also for `onDoubleClick`: same client API, the contract has no own kind) |
| bindings, `OpenBindingEditorModal` | `BINDING` |
| property `onChange`, `PropertyScriptFields` | `ON_CHANGE` |

The code is shown read-only with `issues` (non-empty `issues` is not an error). «Вставить в редактор»
only puts it into the field (asks before replacing the user's own code); saving is the window's
usual button with the usual syntax check.

## Bulk edit — `scripts/edit`

Toolbar button → `ui/assistant/bulk-edit/BulkScriptEditModal`. Scripts are collected once on open by
`lib/assistant/sceneScripts.collectSceneScripts`: server scripts, event handlers, bindings and property
`onChange` of the open scene. The request `id` is `elementKey::place::localId` (the server echoes it).
Limits: ≤ 200 scripts, code ≤ 20 000 chars (longer ones can't be selected), task ≤ 2000.

- A script missing from the answer — the model found the task irrelevant to it.
- `rejected` is shown apart, without code.
- Every proposal shows the line diff (`lib/assistant/lineDiff`), nothing is pre-checked.
- Apply: `model/assistantEdits.applyAssistantScriptEdits` checks scene ownership, version preview and
  the `edit` right, then **skips any script whose current code ≠ `old_code`** (changed after the
  request), and writes the rest in one `setState` — one undo step. The user then saves the scene.

## Tag lookup — `tags/resolve`

`ui/assistant/AssistantTagResolve` in the «Канал» tab of the property tag picker. `path` exists in the
catalog but **may be the wrong channel**: it is only marked in the list, never applied by itself. A click
on a candidate sets the tag exactly like picking it in the tree. Empty `candidates` → a hint to refine.

## Scene plan — `scenes/plan`

Toolbar button → `ui/assistant/scene-plan/ScenePlanModal`: issues, an SVG sketch of the 1920×1080 canvas
and a table. **View only** — plan elements are not editor components (`ComponentCreateDto` is not
served yet, `scada-hh7b`); don't create anything from it until the contract addendum.
