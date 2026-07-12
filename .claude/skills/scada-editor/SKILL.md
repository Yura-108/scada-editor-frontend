---
name: scada-editor
description: Architecture, data model, and conventions of the SCADA scheme editor (the /editor area) in this repo — flat element array, parentKey/children/composition membership, states/overrides + getRenderedElement, Konva rendering (Canvas → ShapeElement/GroupNode), grid snapping, the palette + adding new element types, properties panel, copy/paste, drag-drop, serialization bake/unbake round-trip, and zundo undo. Use this BEFORE reading/editing anything under src/components/editor/**, src/store/useEditorStore.ts, the element palette/properties/registry, canvas interactions, or serialization (buildComponentTree/transformElements). It maps the code and lists the non-obvious gotchas so you don't rediscover them.
---

# SCADA Editor — architecture & gotchas

The editor (`/editor`, `src/app/editor/EditorClient.tsx`) is a Konva-based scheme editor. This is
the core of the repo. Comments and user-facing strings are **in Russian** — match that.

`tsc --noEmit` has a **stable baseline (~10 pre-existing errors)** in `SVGComponents/*`,
`transformElements.ts`, `resolveClickTarget.ts`, and one in the store. `next dev` tolerates them.
Goal when editing: **don't add NEW errors beyond baseline** (check the count before/after).
`next build` is red for the same reason. There is no test runner.

## Core data model (`src/types/editorElement.type.ts`, `src/store/useEditorStore.ts`)

`elements: DiagramElement[]` is a **flat** array. Hierarchy is by keys, not nesting:
- `parentKey` — every element points at its container (or `String(scene.id)` at the root).
- `children: string[]` — **logical components** only (the tree the user sees).
- `composition: string[]` — **primitive members** of a component's drawing (hidden from the tree,
  baked into the component image on save).

Classifiers (top of the store): `isComponentEl` (promoted group `isComponent===true`, or a
`complex` type from `elementRegistry`) vs `isLeafPrimitive`. A plain `group` is a "dumb" visual
grouping; it becomes a logical component only via **createComponentFromGroup** (moves primitives
into `composition`, sets `isComponent`); `disassembleComponent` reverses it. `groupSelected` stays
dumb (everything in `children`).

**Container-mutation invariants** (both fixed once — don't regress): any action that changes a
container's member list must (a) include `composition` in bounds/geometry math, and (b) re-split
members by role via `resplitContainer` when the container is a component (`isComponentEl`) —
`layoutGroupFromBounds` dumps everything into `children`. Any action that re-parents members out
of a container (ungroup) must shift positions via `shiftElementPositions` (module-level helper:
shifts x/y/x1/y1/x2/y2 in base AND all state overrides) — base-only `el.x + groupX` teleports
leaves whose live position sits in overrides.

**Traversal rule of thumb:**
- Geometry (`getElementBounds*`, `getAbsoluteRenderedPos`, descendants) walks by **`parentKey`** →
  already sees composition primitives.
- Lifecycle / copy / cascade-delete / recompute must use **`[...children, ...composition]`**.
- Logical tree + serialization children walk **`children` only**.

## Coordinates, states, rendering

- Child coords are **local to the parent container**. Absolute = sum of rendered x/y up the
  `parentKey` chain (`src/lib/editor/getAbsoluteRenderedPos.ts`).
- **Groups store x/y/w/h in the base element. Leaf elements store visual props in per-state
  `overrides`.** `getRenderedElement(el)` (`src/lib/getRenderedElement.ts`) returns
  `{...el, ...currentState.overrides}` — **always render/measure/position via it, never raw `el`.**
  When a leaf is moved, `updateElementVisual` writes x/y to the current state's overrides, NOT base.
  This is why anything that shifts position (copy/paste offset, etc.) must touch overrides too.
- Each element has `states` (`ComponentState[]`, e.g. "Нормальное"/"Авария"). State changes
  propagate across a subtree **by state name**; `currentComponentStateByElementKey` tracks the
  active state per element.
- `updateElementVisual(key, patch)` writes `patch` into the current state's overrides for leaves
  (into base for groups), clamps w/h to `MIN_SIZE`, and calls `recomputeAncestorBounds` when a
  positional key changed. `updateElement` writes structural fields (scripts, properties, …).

## Konva render tree (`src/components/editor/`)

- `Canvas.tsx` — thin orchestrator (~200 lines): the `<Stage>` sized to the **viewport**
  (`canvasRect` from the store — NEVER a fixed 5000×5000; Konva allocates w×h×DPR canvases per
  layer and a huge stage eats hundreds of MB / breaks Safari; the 5000-unit world is virtual via
  `camera {x,y,zoom}` transform), grid pattern, marquee, context menu, and builds one
  **memoized** `EditorRenderContext` (`canvas/types.ts`) passed to every node. Also owns
  `editingTextKey` + renders `TextEditorOverlay`.
- **Render-perf architecture (don't regress):** `ShapeElement`/`GroupNode` are wrapped in
  `React.memo`; the `ctx` is built with `useMemo` in Canvas, so camera pan/zoom, marquee, and
  menus don't change its identity and the whole scene skips re-render. Consequences:
  (a) anything shapes must react to has to be a `ctx` useMemo dep — in particular
  `currentComponentStateByElementKey` is in ctx ONLY to bust memo on state switch, because
  `getRenderedElement` reads it non-reactively via `getState()`; (b) `useThemeColors` memoizes
  `themeColors` — keep it stable; (c) anchor/handle `onDragMove` handlers write to the store
  **only when the snapped value changes** (grid-step guard), not per mousemove pixel.
- `canvas/shapes/ShapeElement.tsx` — **leaf dispatcher**: `if (rendered.type === "…")` branches →
  a dedicated component, else a generic `<Rect>` fallback (covers rectangle/path/unknown).
- `canvas/shapes/GroupNode.tsx` — recursive group/component; renders `[...composition, ...children]`.
- Dedicated leaf components (all take `ShapeElementProps` from `canvas/types.ts`):
  `TextShapeElement`, `CheckboxShapeElement`, `ProgressBarShapeElement`, `ButtonShapeElement`,
  `ToggleShapeElement`, `SliderShapeElement`, `DropdownShapeElement`, `InputShapeElement`.
- Handles: `Anchor.tsx` (vertex/resize, needs `themeColors`), `CircleResizeHandle.tsx`,
  `ResizeHandleSE.tsx` (shared corner/right-edge box handle, self-contained blue square).
- Stage interaction/pan/zoom/marquee: `canvas/hooks/useStageInteractions.ts` — marquee is
  **scoped** to the current level (`activeGroupKey` ?? scene root), so it never selects a group
  and its children together. Hotkeys: `canvas/hooks/useEditorHotkeys.ts` (Esc / Delete /
  Ctrl+C/V/D/A / arrow-nudge ±GRID, Shift=±1px — **ignores input/textarea/contentEditable**);
  Ctrl+Z/Y live in `EditorClient.tsx`.
- **Multi-drag** lives at the Stage level in `Canvas.tsx` (Konva drag events bubble):
  a drag session starts when the resolved target is one of ≥2 selected keys; other top-level
  selected nodes are moved **imperatively** during dragmove and committed via store
  `moveSelectedBy(dx, dy, excludeKey)` on dragend (their Konva positions are restored first —
  line/circle groups have no controlled x/y, React wouldn't reset them). Every resize/vertex
  handle MUST carry `name="resize-handle"` — that's what excludes it from starting a session.
- **Z-order**: render order = flat-array order (top level) + parent `composition`/`children`
  order (nested). `bringToFront`/`sendToBack` reorder both; context-menu items in
  `buildItemMenu.ts`. Note composition always renders below children inside a component.
- Zoom UI: `canvas/ZoomControls.tsx` (±20% around viewport center, fit-to-content, 100%);
  absolute camera setter `setCamera(x, y, zoom)` in the store. Zoom clamp [0.2, 3].
- **Hover highlight** (Figma-style "what click will select"): Stage `onMouseOver` resolves the
  target via `resolveClickTarget` → `hoveredKey` (Canvas state); drawn as ONE overlay `Rect`
  in the Layer (group frame for groups, rendered bounds for leaves). Deliberately NOT passed
  through ctx/shape props — that would re-render the whole memoized scene on every mouse move.
  Any future per-element hover effect must follow the same single-overlay pattern.
- Properties panel has a «Геометрия» block: numeric X/Y/W/H (lines: X1/Y1/X2/Y2), writes via
  `updateElementVisual` (coords are parent-local).
- Pure geometry helpers live in `src/lib/editor/`.

## Snapping (GRID = 20)

`snap(v) = round(v/GRID)*GRID`, `GRID=20` (`src/lib/utils.ts`). **Snap in world coords.** Konva's
`e.target.x()` is already parent-local/world, so `snap(e.target.x())` on drag is correct. Drops
convert screen→world before placing.

- **On-release snap:** `onDragEnd → updateElementVisual({x:snap(...), y:snap(...)})`.
- **Live "cell-by-cell" snap while dragging:** add
  `onDragMove={(e) => { if (e.target === e.currentTarget) e.target.position({x:snap(e.target.x()), y:snap(e.target.y())}); }}`.
  The new control widgets use this; older shapes only snap on release.
- **GOTCHA — resize-handle `dragend` bubbles.** A draggable child (resize handle) fires
  `dragmove`/`dragend` that **bubble to the parent Group's handlers**, whose `e.target` is then the
  handle (its local x = the new width), teleporting the element. Guard EVERY group drag handler
  that has draggable children with `if (e.target !== e.currentTarget) return;` (see
  `ButtonShapeElement`, `TextShapeElement`). The handle itself sets `e.cancelBubble=true` on
  `onDragStart` only — that stops the group from *starting* a drag, not the bubbled move/end.

## Adding a new element type (5 touch points)

Example to copy: the "Управление" controls (`button/toggle/slider/dropdown/input`).
1. **`src/constants/palette.ts`** — a `PaletteItemType` (unique `id ≥ 10**5`, `type`, `name`,
   `category`, `defaultProps` with **grid-aligned w/h**). Palette groups by `category`
   dynamically; a new category just appears. `id ≥ 10**5` marks it a non-deletable static item.
2. **`src/types/editorElement.type.ts`** — add the string to the **`ElementType` union** and any
   new fields to `LeafElement`. The union now lists ALL real leaf types; keeping it complete is
   what removed a pile of "no overlap" baseline errors — don't regress it.
3. **`src/constants/propertiesPanel.ts`** — add the key to **BOTH** `elementRegistry`
   (`complex:false` for a widget) and `elementPropertyMap` (a `PropertySchema[]`). These are
   `Record<ElementType, …>`, so a new union member is a **required** key — omitting it errors.
4. **`src/store/useEditorStore.ts` → `addElementAt`** — a `if (type === '…')` branch mirroring the
   `checkbox`/`progress_bar` ones (full scaffolding: `id:null, key:createUuid(), composition:[],
   parentId/parentKey scene, children:[], scripts:[], bindings:[], properties:[], states:[{…isDefault}]`).
5. **`src/components/editor/canvas/shapes/`** — a `XxxShapeElement.tsx` on `ShapeElementProps` +
   a dispatch branch in `ShapeElement.tsx`. Include: Group at `rendered.x/y`, selection dashed Rect,
   live-snap drag (with the `e.target===e.currentTarget` guard if it has a resize handle), and a
   `ResizeHandleSE` where resizing makes sense.

Serialization needs **no** change for plain visual props (see below). The drop handler
(`EditorClient.tsx`) already routes non-`custom` types to `addElementAt`.

## Making element params actually functional

The properties panel is generated from `elementPropertyMap[type]` (`PropertiesPanel.tsx`). A param
"exists" in the panel but only *works* if the shape component **reads that exact key**. Common bug:
the panel writes one key while the renderer reads another (e.g. panel `backgroundColor` vs renderer
`bg`). When wiring params: make the renderer read the schema key (fallback to legacy key for old
scenes), and make `addElementAt` seed the same key. `PropertiesPanel.handleSelectChange`
special-cases `orientation` (progress bar) to **swap w/h** so vertical bars become tall/narrow.

## Serialization round-trip (bake ↔ unbake)

Backend stores each component's visual state as an **opaque JSON string** in `states[].image`.
- **Save** — `src/lib/buildComponentTree.ts` (from `exportScene`). `buildBaseImage` serializes an
  element by **deleting** a fixed set of structural keys (id, key, type, parentId/Key, children,
  composition, scripts, bindings, properties, states, label) and JSON-stringifying the rest. So
  **new visual props auto-persist** — no change needed. Component `composition` primitives are baked
  into each state's `image` as a `composition:[descriptor]` array; only `children` become nested nodes.
  `buildShapeDescriptor` explicitly re-adds the primitive's `scripts`/`bindings`/`properties` to the
  descriptor (they'd otherwise be deleted by `buildBaseImage` and silently lost on round-trip).
- **Load** — `src/lib/transformElements.ts` (from `loadScene`). Flattens the tree, **unbakes**
  `image.composition` back into flat primitives re-parented into the component, strips structural
  keys from overrides. Base x/y/w/h come from the unstripped default image. The unbake restores
  `scripts`/`bindings`/`properties` from the descriptor and strips them from visual overrides —
  keep this symmetric with `buildShapeDescriptor`.

Keep the round-trip symmetric when changing one side. Headless check: transpile these two modules +
`createUuid` and run `buildComponentTree → transformElements` in Node (near-zero runtime deps) —
`npx tsc src/lib/{buildComponentTree,transformElements,createUuid}.ts --module commonjs --target
es2020 --noResolve --skipLibCheck --outDir <scratch>`, then sed `@/lib/createUuid` → `./createUuid`.

## Undo / history (zundo `temporal`)

Store is wrapped in `temporal` (`zundo`). Options at the bottom of `useEditorStore.ts`:
`limit:50`, `partialize: s => ({elements})`, and **`equality: (a,b) => a.elements === b.elements`**.
The equality is essential: without it zundo snapshots on **every** `set()` (camera/zoom/pan,
selection, state switch), flooding the stack with duplicate-`elements` entries so Ctrl+Z appears to
do nothing for many presses. Every real elements mutation creates a **new array** (`[...]`/`map`/
`filter`), so reference equality records exactly the real changes and skips the rest.
**After editing the store file, do a FULL page reload** — zundo history/subscriptions don't survive
Fast Refresh cleanly and undo will look broken until you reload.

History hygiene (established rules): `loadScene` (in `finally`), `createScene`, and
`setCurrentProject` call `useEditorStore.temporal.getState().clear()` — undo must never cross a
scene/project boundary (it would resurrect другой сцены elements with `id:null` → server dupes,
since every save calls `loadScene`). Server-synced merges (`addTags`, `editProperty`) wrap their
`set()` in `temporal.pause()`/`resume()` — a server-persisted change must not be undoable
client-side. Apply the same pattern to any new server-mutating action.

## Copy / paste (`copySelectedElement` / `pasteSelectedElement`)

Copy grabs selected + all descendants. Paste remaps keys (`keyMap`), re-parents roots to the scene,
and offsets **root** elements right-down. **GOTCHA:** the offset must shift **all positional fields
(`x,y,x1,y1,x2,y2`)** in **both** the base element **and every state's `overrides`** — because a
moved leaf keeps its live position in overrides (base x/y is stale) and a line lives in
`x1/y1/x2/y2` (its group has no x/y). Offsetting only base x/y leaves those copies on top of the
original. See `shiftPositions` in the paste action.

## Drag-drop onto canvas (`EditorClient.tsx`)

The canvas is the only dnd-kit droppable, and `closestCenter` makes `over.id === "canvas"` almost
always true — so the "is it on the canvas" test is a **bounds check**. Check the drop point in
**screen coords** against `canvasRect` (`localX/localY` within `[0, canvasRect.width/height]`) — NOT
world coords. A previous `[0,5000]` world-coord check wrongly rejected drops far from center after
pan/zoom. World coords are used only to place the element (`addElementAt(worldX, worldY, type)`),
unbounded.

## Guards & conventions

- **Russian** comments and UI strings.
- Scene/project hierarchy is enforced: mutating ops bail via `sceneBelongsToCurrentProject(scene,
  currentProject)`. Preserve these guards.
- Path alias `@/*` → `src/*`. Husky + lint-staged run eslint/prettier on commit.

## Key file index

| Concern | File |
|---|---|
| Store (state + all actions + undo config) | `src/store/useEditorStore.ts` |
| Types (DiagramElement, LeafElement, ElementType, states) | `src/types/editorElement.type.ts` |
| Rendered element (base + active overrides) | `src/lib/getRenderedElement.ts` |
| Canvas orchestrator | `src/components/editor/Canvas.tsx` |
| Leaf dispatch + generic fallback | `src/components/editor/canvas/shapes/ShapeElement.tsx` |
| Group/component recursion | `src/components/editor/canvas/shapes/GroupNode.tsx` |
| Render context / ShapeElementProps / MIN_SIZE | `src/components/editor/canvas/types.ts` |
| Palette items | `src/constants/palette.ts` |
| Registry + property schemas | `src/constants/propertiesPanel.ts` |
| Properties panel UI | `src/components/editor/PropertiesPanel.tsx` |
| Drop handling | `src/app/editor/EditorClient.tsx` |
| Save / load serialization | `src/lib/buildComponentTree.ts`, `src/lib/transformElements.ts` |
| Snapping/GRID | `src/lib/utils.ts` |

## Gotchas checklist (fast recall)

- Render/measure/position leaves via `getRenderedElement`, never raw `el` (overrides win).
- Draggable child handles: guard parent drag handlers with `e.target === e.currentTarget`.
- New element type → update ElementType union **and** both `Record<ElementType>` maps, or tsc breaks.
- Param not working → renderer must read the exact schema key the panel writes.
- Progress bar vertical → w/h are swapped on orientation change (tall/narrow).
- Copy/paste offset → shift x/y/x1/y1/x2/y2 in base **and** all state overrides
  (`shiftElementPositions`, module-level in the store; ungroup uses it too).
- Drop bounds → screen coords vs `canvasRect`, not world `[0,5000]`.
- Undo → keep the `equality` on `temporal`; full-reload after store edits; `clear()` history on
  scene/project switch; `pause()`/`resume()` around server-synced `set()`s.
- Container mutations → include `composition` in bounds; `resplitContainer` for components;
  delete cleans parent `children`/`composition` + `activeGroupKey` and rolls back on server failure.
- Perf → Stage = viewport size (never 5000×5000); shapes are `React.memo` + ctx via `useMemo`
  (new reactive inputs for shapes go into ctx deps); drag handles write to store only on
  grid-step change; `recomputeAncestorBounds`/`getDescendantKeys` use a `Map` index (keep it).
- Grid-align default w/h (multiples of 20) for new elements.
