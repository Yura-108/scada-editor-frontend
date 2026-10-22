# Рецепты (процедуры)

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Recipes: procedural step chains

Contract: `docs/contract/2026-09-09-recipe-steps-contract.md` (verified against the backend
code, not just the doc). A recipe is a **procedure**, not a set of values: a manifest of tags
(`tags[]`) plus ordered `steps[]`, where a step writes tags on entry and then waits for its
condition to become true. It belongs to no component and no scene, but **to a project**
(contract `docs/contract/2026-10-19-recipes-in-project-contract.md`). An earlier design keyed values to a table's `ComponentProperty` and applied them in one
shot; `component_id`, `type`, `values`, `/resolved` and `POST /api/runtime/recipes/apply` are all
gone from both sides.

- **Two lists, two sources.** The editor's `useRecipes` (TanStack Query, `src/modules/editor/api/recipes.ts`) holds the *draft* of the open project
  (`/api/editor/projects/{id}/recipes[/{id}]`, read `view`/`edit`, write `edit`; `id` is a
  per-project slug — URL-encode it, Cyrillic). The monitor never reads it: `useMonitorRecipesStore`
  loads the **prod release's** recipes from `GET /api/runtime/projects/{id}/recipes`, reloaded by
  `useProcedureSync` on `(projectId, releaseVersionNo)` like `procedure-levels`. A saved but
  unreleased recipe does not exist for the wash, and an operator with only `operate` gets 403 on the
  editor paths. Starting a recipe missing from prod answers 409 with a `message` (shown as is). A
  running procedure keeps the recipe it started with; a new prod changes only the list.
  `document_id` is the history key: `recipes` is a `docType` of the history proxy, and
  `RecipeHistoryModal` (button in `RecipesPanel`) lists versions and restores — restore changes the
  draft only, then the list is re-read.
- **`action[].tag` is the short `tags[].name`, not the tag path.** The path lives in
  `RecipeTag.tag`. Getting this wrong is a 400 listing the undeclared names, so the steps editor
  offers a dropdown over the manifest rather than free text.
- **`value_type` must be one of `number` / `bool` / `string`.** `RecipeServiceImpl.requireTypeMatch`
  switches on exactly those and falls through to `default -> true`, so an out-of-vocabulary value
  (e.g. `"float"`, the channel base's own term) does not error — it **silently disables**
  validation. `tagValueType()` therefore returns the contract vocabulary directly. `bool` cannot
  be inferred at all: the channel base only knows «Строковый (IsString)», so discrete tags are
  marked by hand.
- **Execution lives in the monitor**, in two places over one store: a floating `ProcedureHud`
  above the mnemonic scheme (drag/collapse persisted in localStorage) and the detailed
  «Процедуры» tab. `SceneTabs` already supported a non-scene tab via `extraTab` (that's how the
  editor mounts «Рецепты»). Five endpoints drive it: `start` / `status` / `confirm` / `jump` /
  `abort`, proxied under `src/app/api/runtime/recipes/[id]/…`. All of them are keyed by
  `projectId`; `sessionId` rides along only as a signature of which screen pressed the button
  and grants no rights.
- **Behaviour is split so two views can coexist.** `useProcedureControls` is callbacks only
  (safe to call from anywhere); every *effect* — the 5s `GET /status` poll and the alert
  toasts — lives in `useProcedureSync`, **mounted exactly once** in
  `MonitorClient`. Duplicate that hook in a component and you get two polls and two toasts per
  event. A third consumer must follow the same rule.
- **Switching the watched recipe mid-run is safe and needs no confirmation**: a procedure is
  keyed `(projectId, recipeId)` on the backend, so switching only changes what the UI watches —
  the running one keeps going and `GET /status` restores its state on return. Events for other
  recipes are filtered out by `applyEvents`, so their alerts are not shown while you look
  elsewhere; that is deliberate, since an alert without its step context misleads.
- **A 400 from `/status` means the procedure is not running** — never started, or already
  finished. It no longer means "the runtime lost its state": procedure state lives in
  `runtime.procedure_state` and is restored exactly after a restart, so `resume-guess` is gone
  from both sides. The frontend answers by clearing the shown status (`adoptStatuses([])`),
  never by guessing a step.
- **409 is a state, not a failure.** `start` on a running procedure, a `stepIndex` that no
  longer matches, and any call against a project that is not in operation all answer 409. The
  first two carry the current `ProcedureStatusDto` in a `procedure` field, which
  `ProcedureConflictError` surfaces so the operator sees which step the wash is on instead of a
  red toast — a repeated «Запустить» must never re-apply step 0 under a running wash. `jump`
  still works without a prior `start`: that is how an operator places a procedure by hand.
- **`procedures[]` is a third array in the WS `UPDATE` frame** and must NOT go through
  `pendingRef`/`flush`: that path coalesces *values* last-write-wins with a "same value" guard,
  which would swallow `STEP_STARTED`/`STEP_COMPLETED` pairs and drop `WRITE_FAILED`/`STALLED`
  entirely. Events are dispatched straight into `useProcedureStore`. It is a store rather than
  `runtimeEventBus` because that bus is a set of *single slots*, and these events need more than
  one consumer.
- **`WRITE_FAILED` is the only way an operator learns a step's write was rejected** — writes
  inside a step are fire-and-forget. Surface it as an alert. `STALLED` does not stop anything.
- A recipe is **not scene content**: it creates no canvas elements and no scenes. Its manifest
  and steps are shown inline in the «Рецепты» panel by expanding a row. An earlier attempt put
  a generated table on a dedicated scene; that meant canvas elements which had to be kept in
  sync with a recipe living on the backend, for no gain.
