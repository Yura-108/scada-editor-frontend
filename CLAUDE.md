# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Next.js dev server (Turbopack) on http://localhost:3000
npm run lint     # eslint
npm run build    # next build — NOTE: currently fails on pre-existing type errors (see below)
```

- **No test runner** is configured (no jest/vitest). There are no unit tests to run.
- **Husky + lint-staged** run `eslint --fix` + `prettier --write` on staged `*.{js,ts,tsx}` at commit.
- Path alias: `@/*` → `src/*`.
- `tsc --noEmit` reports a **stable baseline of pre-existing type errors** (the `ElementType` union omits `button`/`rectangle`/`checkbox`/`progress_bar`/`path` even though they are used everywhere). The app runs because `next dev` tolerates type errors. When editing, verify you don't *add new* errors beyond this baseline rather than expecting a clean `tsc`. `next build` is currently red for the same reason.

## Backend & data flow

This is a **frontend + BFF**, not a standalone app. Everything under `src/app/api/**/route.ts` is a thin proxy to a separate (Java/Spring) backend:

- `BACKEND_URL_EDITOR` (default `http://localhost:8080`) — editor/scene/component APIs.
- `BACKEND_URL` — device/channel APIs.
- Auth: `protectedRoute` (`src/lib/protected.ts`) reads the `access_token` httpOnly cookie and forwards it as `Authorization: Bearer …`. Wrap every backend-touching route with it.

Three product areas share the app: **editor** (`/editor`, the SCADA scheme editor — the core of this repo), **channels/devices** (`/channels`, device hierarchy + tags), **logs** (`/log`). Stores live in `src/store/` (one Zustand store per area).

## Editor architecture (the important part)

The editor state lives in `src/store/useEditorStore.ts` (Zustand wrapped in **zundo** `temporal` for undo/redo; only `elements` is persisted to history via `partialize`). Understanding these cross-cutting concepts requires reading several files together.

### Flat element array + two kinds of membership

`elements: DiagramElement[]` is a **flat** array. Hierarchy is expressed by keys, not nesting:

- `parentKey` — every element points at its container (or the scene id at the root).
- `children: string[]` — **only logical components** (the tree the user cares about).
- `composition: string[]` — **primitive members** (lines/circles/rects/... that form a component's drawing). Hidden from the logical tree; baked into the component's image on save.

Classifiers (in the store): `isComponentEl` (a promoted group `isComponent===true`, or a `complex` type from `elementRegistry`) vs `isLeafPrimitive`. A plain `group` is a "dumb" visual grouping; it becomes a logical **component** only via the explicit **"Создать компонент"** action (`createComponentFromGroup`), which moves primitive descendants into `composition` and sets `isComponent`. `disassembleComponent` reverses it. `groupSelected` itself stays "dumb" (puts everything in `children`).

**Traversal rule of thumb — get this right when touching the store:**
- Geometry (`getElementBounds*`, `getDescendants`, `getAbsoluteRenderedPosition`) walks by **`parentKey`** → already sees composition primitives, no change needed.
- Lifecycle / state-propagation / copy (`getDescendantKeys`, cascade delete, `recomputeAncestorBounds`, paste/import/template key-remap) must use **`[...children, ...composition]`**.
- Logical tree + serialization children walk **`children` only**.

### Coordinates, states, and rendering

- Child coordinates are **local to the parent container**. Absolute position = sum of rendered `x/y` up the `parentKey` chain (`getAbsoluteRenderedPosition`).
- **Groups store x/y/w/h in the base element; leaf elements store visual props in per-state `overrides`.** `getRenderedElement(el)` returns `{...el, ...currentState.overrides}` — always render/measure via it, never raw `el`. Never write a group's position into overrides (it desyncs `recomputeAncestorBounds`).
- Each element has `states` (`ComponentState[]`, e.g. "Нормальное"/"Авария"). State changes propagate across a component's subtree **by state name**. `currentComponentStateByElementKey` tracks the active state per element.
- Canvas rendering is **Konva** (`react-konva`). `src/components/editor/Canvas.tsx` is a thin orchestrator (~200 lines); the actual rendering lives in `src/components/editor/canvas/` — `shapes/ShapeElement.tsx` (leaf shapes) and `shapes/GroupNode.tsx` (recursive group/component, renders `[...composition, ...children]`), wired via an `EditorRenderContext` object (`canvas/types.ts`). Stage interaction/pan/zoom/marquee is `canvas/hooks/useStageInteractions.ts`; pure geometry helpers are in `src/lib/editor/`.

### Snapping (grid = 20)

`snap(v) = round(v/GRID)*GRID`, `GRID=20` (`src/lib/utils.ts`). **Snapping must happen in world coordinates.** Konva's `e.target.x()` is already parent-local/world (independent of camera pan/zoom), so `snap(e.target.x())` on drag is correct. Drops convert screen→world *before* snapping in `EditorClient.tsx` (`(localX - camera.x)/camera.zoom`). All group paddings are multiples of `GRID`, so grouping/move preserve alignment. When adding a new interaction that sets position/size, snap it.

**The circle is the one type with two anchor points.** The model stores the bbox top-left in `x/y` (plus `radius` and `w = h = 2·radius` — keep all three in sync), but every interaction speaks in terms of the **centre**: the dragged Konva node's position *is* the centre, so `useMultiDragAndGuides` snaps it absolutely (`snapAbsolute`, unlike line/polygon whose inner node carries an offset), `CircleResizeHandle` snaps the radius to `GRID` live and keeps the centre fixed by committing `x = cx − r`, and the properties panel shows «X/Y центра». Centre on a node + radius a multiple of 20 puts the bbox on the grid too. Break the pairing and the shape jumps at drop — the preview grows around the centre while the commit grows around the corner.

### Serialization round-trip (bake ↔ unbake)

The backend stores each component's visual state as an **opaque JSON string** in `states[].image`, so the frontend can enrich it without a contract change.

- **Save** (`src/lib/buildComponentTree.ts`, called from `exportScene`): builds a nested `ComponentCreateDto` tree from the flat array. For a component, `composition` primitives are **baked** into each state's `image` as a `composition: [descriptor]` array (per-state, matched by state name); only `children` (components) become nested nodes. Plain groups serialize primitives as nodes (unchanged legacy behavior).
- **Load** (`src/lib/transformElements.ts`, called from `loadScene`): flattens the nested tree back, **unbakes** `image.composition` descriptors into flat primitive elements re-parented into the component, restoring `isComponent`/`composition`. Base `x/y/w/h` come from the *unstripped* default image.

When changing one side, keep the round-trip symmetric. There is a headless way to check it: transpile these two modules + `createUuid` with `npx tsc … --module commonjs` and exercise `buildComponentTree`→`transformElements` in a Node script (they have almost no runtime deps).

**Server ids of nested entities must round-trip.** Every nested entity that the backend numbers carries a `serverId` next to its local `id`: `ComponentState.serverId`, `ElementScript.serverId`, `TagBinding.serverId`, `ElementEventEntry.serverId`. The local `id` is a uuid used as a React key and must never be sent. `transformElements` / `parseBindings` / `parseEvents` set `serverId` only when the backend actually sent one, and `buildComponentTree` emits `id` only when `serverId` exists. A missing id on an *existing* entity reads as "deleted and recreated" — history is lost and merging reports a phantom conflict; renaming without an id is the case that actually breaks. Bindings additionally echo the pair the server assigned (`componentPropertyId` + `componentPropertyName` → `component_property_id` + `component_property_name`): the name is what lets version restore survive a property being deleted and recreated, so never strip it. Anything that **clones** elements (`cloneElementsWithOffset` for paste/duplicate, `addTemplate` for placing a palette template) must strip all of them via the `detachServer*Ids` helpers — the copy is a new entity, and carrying the original's ids tells the server the entity moved. One deliberate exclusion: **nothing server-assigned goes inside an opaque blob** — neither the binding JSON in `script` nor the baked `composition` descriptors in `states[].image`, because those blobs are rebuilt on every save and compared whole during merge.

### Properties travel with the scene

`element.properties` are **ordinary scene data**, not a separate resource. `buildComponentNode`
sends the **complete** list for every element type; the backend treats the list as the whole set
for that component (missing = deleted, matched first by `id`, then by `name`) and creates the
new ones itself. A binding can attach to a property created in the same request via
`component_property_name`, which is why that field is now always sent.

Consequences worth knowing:

- **A property can be created on an element that does not exist on the server yet.** That is the
  point of the design — it is what makes palette templates work. Owners are therefore addressed
  by **element key**, never by `component_id` (which is `null` until the first save and would
  match every other unsaved element).
- `addProperty` / `editProperty` / `deleteProperty` are **local `set()` mutations**: they enter
  undo and mark the scene dirty. The old machinery is gone — no write queue, no
  `based_on_version` per property, no version re-fetch after each edit, no two-phase
  "save then provision".
- **Exactly one network call survives**: renaming an already-saved property still goes through
  `PUT /api/editor/tags/{id}` (`renamePropertyOnServer`). Its original reason is gone — recipe
  setpoints used to be keyed by the row **name**, and only that endpoint migrated them — but
  recipes no longer reference properties at all (see below), so nothing on the frontend now
  depends on this call. It is kept because what else that backend endpoint does is not visible
  from here; removing it is a deliberate separate change.
- `PropertyCreateDto.id` is optional and identity inside a component rests on the **name** — hence
  the duplicate-name check in `addProperty`/`editProperty` (the backend matches by name too).
- `propertyRefs` address a neighbour's property by `componentKey` + `propertyName`; the numeric
  `propertyId` the runtime routes by is filled in from the save response
  (`resolvePendingPropertyRefs`).

### Recipes: procedural step chains

Contract: `docs/contract/2026-09-09-recipe-steps-contract.md` (verified against the backend
code, not just the doc). A recipe is a **procedure**, not a set of values: a manifest of tags
(`tags[]`) plus ordered `steps[]`, where a step writes tags on entry and then waits for its
condition to become true. It belongs to nothing — no component, no scene, no project; the list
is flat. An earlier design keyed values to a table's `ComponentProperty` and applied them in one
shot; `component_id`, `type`, `values`, `/resolved` and `POST /api/runtime/recipes/apply` are all
gone from both sides.

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
  editor mounts «Рецепты»). Six endpoints drive it: `start` / `status` / `confirm` / `jump` /
  `abort` / `resume-guess`, proxied under `src/app/api/runtime/recipes/[id]/…`.
- **Behaviour is split so two views can coexist.** `useProcedureControls` is callbacks only
  (safe to call from anywhere); every *effect* — the 5s `GET /status` poll, the `resume-guess`
  fetch, the alert toasts — lives in `useProcedureSync`, **mounted exactly once** in
  `MonitorClient`. Duplicate that hook in a component and you get two polls and two toasts per
  event. A third consumer must follow the same rule.
- **Switching the watched recipe mid-run is safe and needs no confirmation**: a procedure is
  keyed `(sessionId, recipeId)` on the backend, so switching only changes what the UI watches —
  the running one keeps going and `GET /status` restores its state on return. Events for other
  recipes are filtered out by `applyEvents`, so their alerts are not shown while you look
  elsewhere; that is deliberate, since an alert without its step context misleads.
- **A 400 from `/status` is not an error** — it means the runtime restarted and lost the
  procedure. That is the signal to fetch `resume-guess` and offer the suggested step; never jump
  automatically, since the guess is wrong on steps whose condition rests on `elapsedMs` or
  `confirmed`. `jump` deliberately works without a prior `start` for exactly this recovery.
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

### Monitor: component menu, actions, manual tag values

The monitor is `<Canvas readOnly />`: the content layer is `listening={false}`, so shapes are out
of Konva's hit graph and `e.target` is always the Stage. Hence two monitor-only mechanisms:

- **Hit-testing is ours, not Konva's** — `src/lib/editor/pickMonitorTarget.ts` walks the members of
  the current level (`activeGroupKey` ?? scene root) top-down by `zIndex` and returns the element
  whose absolute bbox contains the point. Same semantics as the editor's `resolveClickTarget`, only
  downward. Right-click builds the menu from it (`canvas/buildMonitorMenu.ts`), double-click enters
  the container (`enterGroup`) — unless a `MonitorInteractionLayer` rect consumed the event, which
  is how existing `onClick`/`onDoubleClick` schemes keep working at any depth.
- **Menu items**: «Опции» when the element has `property_type === "Тег"` properties, plus one item
  per script with `displayed` (the editor checkbox «Добавить действие в монитор?»). A script runs
  through `emitRuntimeScript` → `sendAction(Number(script.id))` → WS `ACTION`, so it needs a numeric
  **server** id — an unsaved script cannot run. `ElementScript.displayed` rides in the script DTO
  (`{id?, name, script, displayed}`) and is emitted **always**, false included, because the backend
  treats the script list as complete.

**Switching scenes must re-run the bindings.** The WS session lives on `(active, projectId)`
(`useRuntimeEngine`), so changing the scene inside a project keeps it — `valuesRef` holds the
values of *every* project tag, including scenes that are not open. But `applyServerComponents`
resets `currentComponentStateByElementKey` (and now `runtimeOverridesByElementKey`) when the
document is replaced, and `flush` only executes bindings of tags whose value *changed*. So a
scene opened after its values already arrived would stay in its default state forever — the
telemetry keeps repeating the same value and the no-op guard drops it. The effect on `index`
therefore seeds property/table values and then re-runs `index.all` (filtered by
`hasKnownTrigger`) through the shared `runBindings`, applying everything in one
`applyRuntimeBatch`. Anything that replaces `elements` must keep that path intact: a scene whose
bindings never ran shows a confident but wrong mimic, which is the worst failure mode here.

**Written tag values are shown once, not pinned.** After a successful
`POST /api/runtime/tags/write` the modal calls `notifyRuntimeTagsWritten` (`runtimeEventBus`), and
the engine's handler drops the values into `pendingRef` and calls `flush` synchronously — the
operator sees the command land without waiting for a frame, which on a slow tag would be minutes.
That is the *whole* mechanism: the value carries no priority, so the next frame for that tag
overwrites it and the tag stays free to change from a script, another operator, or the PLC itself.
Never pre-write `valuesRef` — the no-op guard in `flush` would swallow the change and no binding
would fire. The handler also seeds `tagMetaRef` for a tag that has **no** entry yet, so a confirmed
write lifts the «нет данных» overlay off the element it just set; a tag already reporting bad
quality keeps its entry and its overlay, because our write says nothing about someone else's BAD.
There is deliberately no sticky-override map any more (`manualTagValues` and its badge are gone):
an override that outlives telemetry is a mimic that confidently shows what the hardware no longer
holds.

### Document versions (undo → versioning)

Contract: `docs/contract/frontend-contract-changes.md` (revision of 17.08.2026). The unit of history is the **whole scene**, not an action. Client-side Ctrl+Z (zundo) is unrelated and stays.

- **Save envelope.** `exportScene` sends `PUT {components, scene_id, based_on_version, save_kind}`. `save_kind` comes from an explicit `kind` option (`MANUAL` / `AUTOSAVE`) — never inferred from `silent`, which only means "no toast"; `"RESTORE"` is server-only and sending it is a 400. The BFF (`src/lib/saveEnvelope.ts` + `api/editor/components/route.ts`) forwards that `PUT` to the backend unchanged — one shape, no alternatives; the transitional `EDITOR_SAVE_ENVELOPE` flag that used to switch body *and* method has been removed along with the legacy `POST`-with-a-bare-array path. Responses are still normalized to `{components, version_no}` (`normalizeSaveResponse`), and a missing `version_no` is the signal that the response shape is not guaranteed — the store then reloads the scene instead of trusting the returned tree.
- **`PUT` means "here is the entire scene".** A component missing from the body is **deleted** by the backend. `buildComponentTree` already serializes every element of the scene, so this needs no diffing — but it also means there is deliberately **no out-of-band `DELETE`** any more: `deleteSelectedElement` and `ungroupSelected` only mutate local state and let the next save persist the removal. The BFF `DELETE` route is gone entirely — nothing called it. Consequence to keep in mind: a deletion that is never saved is a deletion that never happened.
- **`based_on_version`** comes from `sceneVersion`, learned via `GET …/versions?limit=1` (`refreshSceneVersion`) because the plain scene GET does not carry it today. When there are no versions the field is **omitted entirely** — sending it against a version-less scene is a 400.
- **409 is not an error path.** For a *manual* save it fills `saveConflict` and opens `SaveConflictDialog`; the canvas is untouched and `isDirty` stays true. One code path covers both `version_mismatch` (no `conflicts` list) and `merge_conflict` (with one); only the wording differs. **Merging only ever happens for `PUT` + `MANUAL`**, so an *autosave* 409 is routine and must not raise a modal: it sets `staleBaseVersion` (rendered by `StaleVersionBanner`) and deliberately leaves `sceneVersion` alone — advancing it would send the next manual save with someone else's base and overwrite their work without the merge dialog ever appearing. A `merged` block on a *successful* save must be surfaced (`reportMergedChanges`) **even when `changes` is empty** — the empty case still means the save landed on top of a newer version. In conflict rows, `path === "Сцена"` is a reserved address for a top-level ordering conflict, not a component of that name (`formatConflictPath`).
- **Document shape differs between endpoints.** The save response puts an *array* in `components`; the restore response puts the *whole document* there, and a plain document GET uses `children`. `rootComponentsOf` (`src/lib/editor/documentComponents.ts`) is the single place that resolves all three — reading `components` with `Array.isArray` on a restore response silently yields `[]` and wipes the canvas.
- **History endpoints** are proxied under `/api/editor/history/{scenes|templates}/{id}/…` (`src/lib/editorHistoryProxy.ts`). `docType` is whitelisted because it is interpolated into the backend URL; `kind` may repeat, so use `getAll`. Paging uses a `to = created_at` cursor, never an offset.
- **Version preview** reuses `Canvas readOnly` (the monitor's path). Entering stashes live state in a module var, pauses `temporal`, and marks the scene saved so the dirty flag describes the version, not the user's work; exiting restores everything including `savedElementsSnapshot`. **Anything that can mutate or persist must bail on `versionPreview`** — `exportScene`, the autosave tick, the properties panel, and the unload warning (`hasUnsavedWork`, which reads the stash) all do. Crossing a document boundary (`loadScene`, `createScene`, `deleteScene`, `setCurrentProject`) calls `discardVersionPreview`, which drops the stash rather than restoring it into a different scene.

## Editing conventions

- Comments and user-facing strings in this codebase are in **Russian**; match that when adding to editor/store code.
- The scene/project hierarchy is enforced: operations bail if the scene doesn't belong to `currentProject` (`sceneBelongsToCurrentProject`). Preserve these guards.
