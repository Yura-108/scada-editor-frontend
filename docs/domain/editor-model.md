# Модель редактора: элементы, состояния, сериализация

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.


The editor state lives in `useEditorStore` — assembled in `src/modules/editor/model/editorStore.ts` from the zone slices in `model/slices/`, imported from `@/modules/editor` (Zustand wrapped in **zundo** `temporal` for undo/redo; only `elements` is persisted to history via `partialize`). Understanding these cross-cutting concepts requires reading several files together.

## Flat element array + two kinds of membership

`elements: DiagramElement[]` is a **flat** array. Hierarchy is expressed by keys, not nesting:

- `parentKey` — every element points at its container (or the scene id at the root).
- `children: string[]` — **only logical components** (the tree the user cares about).
- `composition: string[]` — **primitive members** (lines/circles/rects/... that form a component's drawing). Hidden from the logical tree; baked into the component's image on save.

Classifiers (in the store): `isComponentEl` (a promoted group `isComponent===true`, or a `complex` type from `elementRegistry`) vs `isLeafPrimitive`. A plain `group` is a "dumb" visual grouping; it becomes a logical **component** only via the explicit **"Создать компонент"** action (`createComponentFromGroup`), which moves primitive descendants into `composition` and sets `isComponent`. `disassembleComponent` reverses it. `groupSelected` itself stays "dumb" (puts everything in `children`).

**Traversal rule of thumb — get this right when touching the store:**
- Geometry (`getElementBounds*`, `getDescendants`, `getAbsoluteRenderedPosition`) walks by **`parentKey`** → already sees composition primitives, no change needed.
- Lifecycle / state-propagation / copy (`getDescendantKeys`, cascade delete, `recomputeAncestorBounds`, paste/import/template key-remap) must use **`[...children, ...composition]`**.
- Logical tree + serialization children walk **`children` only**.

## Coordinates, states, and rendering

- Child coordinates are **local to the parent container**. Absolute position = sum of rendered `x/y` up the `parentKey` chain (`getAbsoluteRenderedPosition`).
- **Groups store x/y/w/h in the base element; leaf elements store visual props in per-state `overrides`.** `getRenderedElement(el)` returns `{...el, ...currentState.overrides}` — always render/measure via it, never raw `el`. Never write a group's position into overrides (it desyncs `recomputeAncestorBounds`).
- Each element has `states` (`ComponentState[]`, e.g. "Нормальное"/"Авария"). State changes propagate across a component's subtree **by state name**. `currentComponentStateByElementKey` tracks the active state per element.
- Canvas rendering is **Konva** (`react-konva`). `src/modules/editor/ui/canvas/Canvas.tsx` is a thin orchestrator (Stage + layers in `layers/`, click and menu logic in `hooks/`, monitor clicks in `hooks/useMonitorClicks.ts`); the actual rendering lives in `src/core/canvas/` (shared with the monitor) — `shapes/ShapeElement.tsx` (leaf shapes) and `GroupNode` in `shapes/CanvasNode.tsx` (recursive group/component, renders `[...composition, ...children]`), wired via an `EditorRenderContext` object (`core/canvas/types.ts`). Shapes read the scene through `useSceneView` (`core/scene/sceneView.ts`, the editor store binds itself), never `useEditorStore` directly. Stage interaction/pan/zoom/marquee is `src/modules/editor/ui/canvas/hooks/useStageInteractions.ts`; pure geometry helpers are in `src/core/scene/`.

## Snapping (grid = 20)

`snap(v) = round(v/GRID)*GRID`, `GRID=20` (`src/core/scene/geometry/grid.ts`). **Snapping must happen in world coordinates.** Konva's `e.target.x()` is already parent-local/world (independent of camera pan/zoom), so `snap(e.target.x())` on drag is correct. Drops convert screen→world *before* snapping in `EditorClient.tsx` (`(localX - camera.x)/camera.zoom`). All group paddings are multiples of `GRID`, so grouping/move preserve alignment. When adding a new interaction that sets position/size, snap it.

**The circle is the one type with two anchor points.** The model stores the bbox top-left in `x/y` (plus `radius` and `w = h = 2·radius` — keep all three in sync), but every interaction speaks in terms of the **centre**: the dragged Konva node's position *is* the centre, so `useMultiDragAndGuides` snaps it absolutely (`snapAbsolute`, unlike line/polygon whose inner node carries an offset), `CircleResizeHandle` snaps the radius to `GRID` live and keeps the centre fixed by committing `x = cx − r`, and the properties panel shows «X/Y центра». Centre on a node + radius a multiple of 20 puts the bbox on the grid too. Break the pairing and the shape jumps at drop — the preview grows around the centre while the commit grows around the corner.

## Group frames hug their content

`recomputeAncestorBounds` (`src/modules/editor/model/elementTree.ts`) pads with `GROUP_PADDING` — the **same**
constant `unionBounds` uses when a group is created. It is now **0**: the frame runs exactly
along the members' outline (geometric edges — stroke width is not part of the bounds). It was
20 before, so older saved schemes keep the 20px margin until their group is next edited. Any
non-zero value must stay a multiple of `GRID`. There used to be a second
`RECOMPUTE_EXTRA_PADDING` on top, so a group was born with a 20px margin and jumped to 40 the
moment any member moved; the origin-shift it claimed to compensate for is actually handled by
the counter-shift loop that adjusts children in base *and* in every state's overrides.

With no margin, a group made only of horizontal (or vertical) lines has `h` (or `w`) of 0, so
its background `Rect` in `GroupNode` — the group's only hit area — has no fill to click. That
`Rect` therefore gets an invisible `hitStrokeWidth` whenever a side is below `MIN_SIZE`.
The selection / active-group frame is **not** drawn by that background `Rect` (it sits under
the members, so an edge shape would hide it): `GroupFrame` in `CanvasNode.tsx` draws it
*after* the members as two non-listening `Rect`s — a `handleFill` halo under a solid
solid line — `selection` blue for a selected group, `activeGroup` orange for an entered one (the
only way to tell "inside the group" from "group selected"), both with
`strokeScaleEnabled={false}` so the width is in screen pixels. The line stands **2 screen
pixels** outside the content (`FRAME_GAP_PX`) — a purely visual offset, the group's
`x/y/w/h` stay on the content. Converting screen px to world units needs `zoom`, which
`GroupFrame` reads through its own `camera.zoom` subscription (never through ctx); it is
mounted only while the frame is visible.

Members are filtered through `isBoundsContributor` (`src/core/scene/geometry/boundsContributor.ts`)
before the union: `visible: false` (CONTUR's `contur_meta` element used to stretch frames to
the origin), zero-size elements (which pin a corner while drawing nothing), and empty groups
(whose bounds fall back to their own already-padded `w/h`, compounding ~80px per nesting
level). Point-based types (line/curve/polygon) pass through — their bounds come from points,
so a horizontal line's `h: 0` is not "empty". The filter lives there rather than in
`getElementBounds` on purpose: that module also feeds fit-to-screen, the selection frame and
smart guides.

`POSITIONAL_KEYS` in `updateElementVisual` gates the recompute, so it lists everything that
moves the measured box — not just coordinates but `text`/`fontSize`/`fontFamily`/`bold`/
`autoWidth` (text is measured by `measureText`, not `w/h`), `rotate` and `visible`.

Frames are **not** migrated on load: an old scheme tightens when its group is next edited.

## Serialization round-trip (bake ↔ unbake)

The backend stores each component's visual state as an **opaque JSON string** in `states[].image`, so the frontend can enrich it without a contract change.

- **Save** (`src/core/scene/serialization/buildComponentTree.ts`, called from `exportScene`): builds a nested `ComponentCreateDto` tree from the flat array. For a component, `composition` primitives are **baked** into each state's `image` as a `composition: [descriptor]` array (per-state, matched by state name); only `children` (components) become nested nodes. Plain groups serialize primitives as nodes (unchanged legacy behavior).
- **Load** (`src/core/scene/serialization/transformElements.ts`, called from `loadScene`): flattens the nested tree back, **unbakes** `image.composition` descriptors into flat primitive elements re-parented into the component, restoring `isComponent`/`composition`. Base `x/y/w/h` come from the *unstripped* default image.

When changing one side, keep the round-trip symmetric. There is a headless way to check it: transpile these two modules + `createUuid` with `npx tsc … --module commonjs` and exercise `buildComponentTree`→`transformElements` in a Node script (they have almost no runtime deps).

**Server ids of nested entities must round-trip.** Every nested entity that the backend numbers carries a `serverId` next to its local `id`: `ComponentState.serverId`, `ElementScript.serverId`, `TagBinding.serverId`, `ElementEventEntry.serverId`. The local `id` is a uuid used as a React key and must never be sent. `transformElements` / `parseBindings` / `parseEvents` set `serverId` only when the backend actually sent one, and `buildComponentTree` emits `id` only when `serverId` exists. A missing id on an *existing* entity reads as "deleted and recreated" — history is lost and merging reports a phantom conflict; renaming without an id is the case that actually breaks. Bindings additionally echo the pair the server assigned (`componentPropertyId` + `componentPropertyName` → `component_property_id` + `component_property_name`): the name is what lets version restore survive a property being deleted and recreated, so never strip it. Anything that **clones** elements (`cloneElementsWithOffset` for paste/duplicate, `addTemplate` for placing a palette template) must strip all of them via the `detachServer*Ids` helpers — the copy is a new entity, and carrying the original's ids tells the server the entity moved. One deliberate exclusion: **nothing server-assigned goes inside an opaque blob** — neither the binding JSON in `script` nor the baked `composition` descriptors in `states[].image`, because those blobs are rebuilt on every save and compared whole during merge.

## Properties travel with the scene

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
  from here; removing it is a deliberate separate change. **It writes a new scene version**
  (`version_no` in the response, contract `2026-09-25-script-syntax-check-contract.md`, `scada-r9lr`):
  `adoptPropertyEditVersion` takes it as `sceneVersion` *before* the local rename, but only if it
  is our base or base + 1 — any other number means someone else saved in between, so the base is
  kept and `staleBaseVersion` raised (adopting it would let the next save skip the merge). It also
  drops the scene-cache entry.
- `PropertyCreateDto.id` is optional and identity inside a component rests on the **name** — hence
  the duplicate-name check in `addProperty`/`editProperty` (the backend matches by name too).
- A property has **three names** (contract `docs/contract/2026-09-24-property-label-contract.md`):
  `name` — the script address (`OP.V`, `component_property_name`), `label` («Имя») — what the
  operator sees in the monitor's «Опции», `gateway_name` («Имя для шлюза») — formerly
  `description`. Properties travel as whole objects, so `normalizeProperty`
  (`transformElements.ts`) maps `description → gateway_name` and **drops** `description` on every
  way in (scene/template load, baked `composition` descriptors, JSON import); otherwise the old
  name would ride along to the server. Table cells bound to `field: "description"` still render
  `gateway_name`.
- `propertyRefs` address a neighbour's property by `componentKey` + `propertyName`; the numeric
  `propertyId` the runtime routes by is filled in from the save response
  (`resolvePendingPropertyRefs`).
