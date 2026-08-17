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

### Serialization round-trip (bake ↔ unbake)

The backend stores each component's visual state as an **opaque JSON string** in `states[].image`, so the frontend can enrich it without a contract change.

- **Save** (`src/lib/buildComponentTree.ts`, called from `exportScene`): builds a nested `ComponentCreateDto` tree from the flat array. For a component, `composition` primitives are **baked** into each state's `image` as a `composition: [descriptor]` array (per-state, matched by state name); only `children` (components) become nested nodes. Plain groups serialize primitives as nodes (unchanged legacy behavior).
- **Load** (`src/lib/transformElements.ts`, called from `loadScene`): flattens the nested tree back, **unbakes** `image.composition` descriptors into flat primitive elements re-parented into the component, restoring `isComponent`/`composition`. Base `x/y/w/h` come from the *unstripped* default image.

When changing one side, keep the round-trip symmetric. There is a headless way to check it: transpile these two modules + `createUuid` with `npx tsc … --module commonjs` and exercise `buildComponentTree`→`transformElements` in a Node script (they have almost no runtime deps).

**Server ids of nested entities must round-trip.** Every nested entity that the backend numbers carries a `serverId` next to its local `id`: `ComponentState.serverId`, `ElementScript.serverId`, `TagBinding.serverId`, `ElementEventEntry.serverId`. The local `id` is a uuid used as a React key and must never be sent. `transformElements` / `parseBindings` / `parseEvents` set `serverId` only when the backend actually sent one, and `buildComponentTree` emits `id` only when `serverId` exists. A missing id on an *existing* entity reads as "deleted and recreated" — history is lost and merging reports a phantom conflict; renaming without an id is the case that actually breaks. Bindings additionally echo the pair the server assigned (`componentPropertyId` + `componentPropertyName` → `component_property_id` + `component_property_name`): the name is what lets version restore survive a property being deleted and recreated, so never strip it. Anything that **clones** elements (`cloneElementsWithOffset` for paste/duplicate, `addTemplate` for placing a palette template) must strip all of them via the `detachServer*Ids` helpers — the copy is a new entity, and carrying the original's ids tells the server the entity moved. Two deliberate exclusions: `properties` keep their ids (`PropertyCreateDto.id` is a required number and they live on the separate `/api/editor/tags` path), and **nothing server-assigned goes inside an opaque blob** — neither the binding JSON in `script` nor the baked `composition` descriptors in `states[].image`, because those blobs are rebuilt on every save and compared whole during merge.

### Document versions (undo → versioning)

Contract: `frontend-contract-changes.md` in the repo root (revision of 17.08.2026). The unit of history is the **whole scene**, not an action. Client-side Ctrl+Z (zundo) is unrelated and stays.

- **Save envelope.** `exportScene` sends `PUT {components, scene_id, based_on_version, save_kind}`. `save_kind` comes from an explicit `kind` option (`MANUAL` / `AUTOSAVE`) — never inferred from `silent`, which only means "no toast"; `"RESTORE"` is server-only and sending it is a 400. The BFF (`src/lib/saveEnvelope.ts` + `api/editor/components/route.ts`) decides what reaches the backend: with `EDITOR_SAVE_ENVELOPE` set it forwards the `PUT` with the whole envelope, otherwise it falls back to the legacy `POST` with a bare array. That flag is the whole compatibility story — **it switches the method too**, so flipping the contract is one env var, not a synchronized deploy. Responses are normalized to `{components, version_no}` either way.
- **`PUT` means "here is the entire scene".** A component missing from the body is **deleted** by the backend. `buildComponentTree` already serializes every element of the scene, so this needs no diffing — but it also means there is deliberately **no out-of-band `DELETE`** any more: `deleteSelectedElement` and `ungroupSelected` only mutate local state and let the next save persist the removal. The BFF `DELETE` route survives for the legacy path only (it no-ops once the envelope is on) and nothing in the client calls it. Consequence to keep in mind: a deletion that is never saved is a deletion that never happened.
- **`based_on_version`** comes from `sceneVersion`, learned via `GET …/versions?limit=1` (`refreshSceneVersion`) because the plain scene GET does not carry it today. When there are no versions the field is **omitted entirely** — sending it against a version-less scene is a 400.
- **409 is not an error path.** For a *manual* save it fills `saveConflict` and opens `SaveConflictDialog`; the canvas is untouched and `isDirty` stays true. One code path covers both `version_mismatch` (no `conflicts` list) and `merge_conflict` (with one); only the wording differs. **Merging only ever happens for `PUT` + `MANUAL`**, so an *autosave* 409 is routine and must not raise a modal: it sets `staleBaseVersion` (rendered by `StaleVersionBanner`) and deliberately leaves `sceneVersion` alone — advancing it would send the next manual save with someone else's base and overwrite their work without the merge dialog ever appearing. A `merged` block on a *successful* save must be surfaced (`reportMergedChanges`) **even when `changes` is empty** — the empty case still means the save landed on top of a newer version. In conflict rows, `path === "Сцена"` is a reserved address for a top-level ordering conflict, not a component of that name (`formatConflictPath`).
- **Document shape differs between endpoints.** The save response puts an *array* in `components`; the restore response puts the *whole document* there, and a plain document GET uses `children`. `rootComponentsOf` (`src/lib/editor/documentComponents.ts`) is the single place that resolves all three — reading `components` with `Array.isArray` on a restore response silently yields `[]` and wipes the canvas.
- **History endpoints** are proxied under `/api/editor/history/{scenes|templates}/{id}/…` (`src/lib/editorHistoryProxy.ts`). `docType` is whitelisted because it is interpolated into the backend URL; `kind` may repeat, so use `getAll`. Paging uses a `to = created_at` cursor, never an offset.
- **Version preview** reuses `Canvas readOnly` (the monitor's path). Entering stashes live state in a module var, pauses `temporal`, and marks the scene saved so the dirty flag describes the version, not the user's work; exiting restores everything including `savedElementsSnapshot`. **Anything that can mutate or persist must bail on `versionPreview`** — `exportScene`, the autosave tick, the properties panel, and the unload warning (`hasUnsavedWork`, which reads the stash) all do. Crossing a document boundary (`loadScene`, `createScene`, `deleteScene`, `setCurrentProject`) calls `discardVersionPreview`, which drops the stash rather than restoring it into a different scene.

## Editing conventions

- Comments and user-facing strings in this codebase are in **Russian**; match that when adding to editor/store code.
- The scene/project hierarchy is enforced: operations bail if the scene doesn't belong to `currentProject` (`sceneBelongsToCurrentProject`). Preserve these guards.
