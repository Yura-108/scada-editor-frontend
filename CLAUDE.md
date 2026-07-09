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

## Editing conventions

- Comments and user-facing strings in this codebase are in **Russian**; match that when adding to editor/store code.
- The scene/project hierarchy is enforced: operations bail if the scene doesn't belong to `currentProject` (`sceneBelongsToCurrentProject`). Preserve these guards.
