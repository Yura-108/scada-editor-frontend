# Монитор: вид, выбор, меню, привязки, WS

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Monitor view lock (the lock in the zoom panel)

The lock is **set in the editor and acts in the monitor**. Pressing it stores what the engineer
currently sees — `monitorView = {x, y, w, h}` in world units — in the sheet's meta element
(`isMetaElement`, next to `canvas`), so it is scene data: undo, dirty flag, saved with the
scene, visible on any machine. The editor camera is never restricted; the editor only draws a
dashed frame of the locked area. `src/lib/editor/monitorView.ts` holds all the math.

- **Width-fit, not the same camera**: the monitor canvas is a different size from the editor's,
  so the monitor zooms to fit `w` into its full width and aligns the left and top edges
  (`cameraForMonitorView`). `h` is only for the editor frame.
- **Monitor with a locked view**: no zoom (Ctrl+wheel, pinch, buttons — the zoom panel is replaced
  by a badge), no middle-button pan, no horizontal wheel; the wheel scrolls vertically, clamped to
  the sheet (`lockedTopRange`; the locked top itself is always allowed even if it sits outside
  the sheet). `useSceneCameraMemory("monitor")` applies it over the browser's remembered camera
  and re-fits on resize, keeping the operator's scroll for the same scene.
- `monitorView` is in `STRUCTURAL_KEYS` of `transformElements` and restored from the default
  image: `setMonitorView` writes the base, and a copy left in overrides would win on the next save.

## Monitor picking resolves to the deepest element

`pickMonitorTarget` descends into `composition`+`children` and returns the innermost element
under the cursor, falling back to a container when no child of it is hit (so a click in a
group's padding still selects the group). `activeGroupKey` only chooses the level the descent
starts from, so enter/exit behaviour is unchanged. This makes the right-click menu agree with
`onClick` scripts, which already resolved deeply — `MonitorInteractionLayer` lays a rect over
every element with a handler at any depth and Konva takes the topmost.

Two consequences to keep in mind:

- **Double-click needs `pickMonitorContainer`, not the deep pick** — the deep pick returns a
  leaf, and entering a group by it would never fire.
- **The context menu climbs back up.** Tags and `displayed` scripts usually live on the
  *component*, while its inner primitives carry none, so `Canvas.handleMonitorContextMenu`
  walks `parentKey` from the picked element to the nearest ancestor with menu items
  (`hasMonitorMenu`). Without that, right-clicking a primitive inside a component would open
  nothing where it used to open the component's menu.

Rotation is still ignored by the pick (axis-aligned bbox) while the interaction rects honour
it, so the two can disagree at the edges of a rotated element.

## Monitor: component menu, actions, manual tag values

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
- **Left click and tap open the same menu** when nothing consumed them (`Canvas.handleMonitorClick`,
  Stage `onClick`/`onTap`): a rect with an `onClick` script sets `cancelBubble`, so the menu only
  appears for a click without an `onClick` — including on an `onDoubleClick`-only element. Touch
  panels have no right button; without this the menu was unreachable there. The menu is **delayed
  by `Konva.dblClickWindow`** when a double click means something (enterable container,
  `onDoubleClick` rect) and always for touch: the menu opens under the pointer, so the second click
  would land on a menu item instead of the canvas, and on empty Stage Konva does not
  `preventDefault` a touch, so the browser's emulated `mousedown` would close the menu and its
  emulated `click` would pass for a second click (ignored via `lastTapAtRef`). A second click
  inside the window, or any dblclick, cancels the pending menu.
- **Scene navigation skips the confirmation.** `isNonWritingScript` (`lib/runtime/eventScript.ts`)
  is a static check: `openScene(` present and no mention of `runScript`/`setProperty` anywhere,
  comments included — so any doubt keeps the dialog. `setProp`/`setState` only restyle the element
  and do not count. Menu actions (server scripts) always confirm.
- **Action arguments and choice menus** (contract `docs/contract/2026-10-02-action-args-contract.md`).
  `ACTION` may carry `args` — a JSON object the server script sees as `args`. In `onClick`,
  `runScript("Имя", {recipe: 4})` sends them; `showMenu([{label, script, args}])` opens a menu at
  the click point whose item runs `script` with its `args`. The backend silently drops a non-object
  `args` and rejects one over 4096 chars with no reply, so `normalizeActionArgs` (`eventScript.ts`)
  refuses both on our side and snapshots the object via JSON at call time. `showMenu` is a result
  intent (`res.menu`, like `openScene`; `openScene` wins if both): the click point travels through
  `emitRuntimeEvent(…, point)`, the engine passes the menu to the `showRuntimeMenu` bus slot, and
  `Canvas` (readOnly, live only) draws it with `buildChoiceMenu`. Confirmation moves to the chosen
  item («Выполнить «Скрипт»: пункт?») — `isNonWritingScript` lets a click whose script only does
  `openScene`/`showMenu` through without a dialog, otherwise the operator would get two.

**The right-click menu is sized per component.** `element.monitorMenu` (`{width, fontSize,
itemHeight}` in px — the menu *plate* with «Опции» and the `displayed` actions, not the «Опции»
modal) is set in the editor on the «Свойства» tab via `MonitorMenuSettingsBlock`, which also
renders a live preview through the same `ContextMenuPanel` the monitor uses. It rides inside
`states[].image` like `zIndex`: it is in `BASE_ONLY_KEYS` (never written to overrides) and in
`STRUCTURAL_KEYS` of `transformElements` (stripped from overrides, restored into the base from the
default image — for `composition` primitives too). `readMonitorMenu` (`src/lib/editor/monitorMenu.ts`)
clamps it on every read. The settings come from the element that **owns** the menu — the ancestor
`handleMonitorContextMenu` climbs to — and editor menus never get any. `optionsWindow` is a dead
predecessor (sized the modal for a day): it is only stripped on load, never restored.

**Object inspector** (`ObjectInspectorModal`, contract `docs/contract/2026-10-01-object-inspector-contract.md`):
any object of the prod release, from every scene (`GET /api/runtime/projects/{id}/objects`, re-read
on a new `releaseVersionNo`), with all its properties. Values need no new channel — the engine
exposes them through the bus (`getRuntimeTagValue`, `getRuntimeTagQuality`,
`getRuntimePropertyValue`, read once a second like «Опции»). Properties arrive for the whole
project, but tags only for the subscribed scene, so the inspector registers the selected object's
tags in `runtimeTagInterest` (see the scene subscription below). A tag property writes to the PLC via `tags/write`; a local one via
`POST …/projects/{id}/properties/write` (journal kind `PROPERTY_WRITE`). Never show the written
value locally — the UPDATE that follows is what proves runtime holds it. `UNKNOWN_PROPERTY` means
the list is stale: re-read it. Opened from the monitor toolbar and the component menu, live only —
never in the archive.

**The WS is subscribed to the open scene** (contract
`docs/contract/2026-10-08-ws-scene-subscription-contract.md`). `{"type":"SUBSCRIBE_SCENE", sceneId,
tags}` makes runtime send `UPDATE.tags` only for that scene's subtree plus `tags`, and put the
scene's current values into the next `UPDATE` at once. `SNAPSHOT`, `properties`, procedures and
tasks are not filtered. How the frontend drives it:

- **The subscription effect in `useRuntimeEngine`** fires on `(sceneId, sceneTags, extraTags)` and
  is declared *before* the "re-run bindings on scene change" effect on purpose. **`tags` carries
  only off-scene tags** — `runtimeTagInterest` minus `sceneTags`, and no field at all when that is
  empty (`docs/contract/2026-10-09-ws-scene-subscription-tags-fix.md`). Runtime finds the scene's
  tags itself, properties and direct bindings included (`composition` primitives too). Sessions of
  one scene without `tags` share a single serialized `UPDATE`; a non-empty `tags` makes the
  session's set unique and costs runtime a per-session frame. A scene tag that freezes or shows
  «нет данных» without being in `tags` is a runtime index bug (report `sceneId` + tag path), not
  something to fix by adding it to `tags`. The full set (scene + panels) is still what decides
  locally whether the subscription changed and which values to drop.
- **Values that fall out of the subscription are dropped**, not kept: only tags in *previous ∩ new*
  survive in `valuesRef`/`pendingRef`/`tagMetaRef` (intersection, because a straggler frame that
  arrived after leaving the scene is stale too). Returning to a scene therefore shows «нет данных»
  for one frame instead of a confidently wrong mimic, and the immediate `UPDATE` runs the bindings
  through `flush` (no value in `valuesRef` → not a no-op).
- `runtimeConnection` remembers the subscription and resends it in `onopen` (a new session knows
  nothing of it); `TREE_CHANGED` forgets it on both sides (`lastSubRef = null`), because runtime
  drops it and the new release's scene ids may differ — the effect resubscribes once
  `reloadRelease` redraws the scene. The archive mode never subscribes.
- **Panels that show tags outside the scene must register them** in `runtimeTagInterest`
  (`setRuntimeTagInterest(owner, tags)` / `clearRuntimeTagInterest(owner)`); the engine unions
  them into `tags`. Today only the object inspector does (the selected object's tags). A new
  consumer that skips this sees its values freeze, then reset to «нет данных».

**The monitor session is an observer, not the owner of the work.** A project runs while its
«in operation» flag is set (`GET|PUT /api/editor/projects/{id}/runtime` ⇄ `{inOperation}`,
mirrored in the store as `projectRuntimeFlags` — the flag is a separate table and does **not**
come with the project list, so it is fetched per project). Closing the tab drops the observer
only; procedures keep running. Two consequences the frontend must honour:

- `POST /sessions` answers **409** for a project that is not in operation. It is terminal —
  status `rejected`, no reconnect — because the retry loop would hide the reason behind
  «Переподключение…», and the monitor shows the backend's text on the canvas instead.
- The **first WS frame is `SNAPSHOT`** (`{tags, properties, procedures}`, where `procedures`
  are *statuses*, not events — the list is complete, so a watched recipe missing from it means
  "not running"). Its values go through `pendingRef` + a synchronous `flush`, exactly like an
  operator's tag write. Pre-writing `valuesRef` would make the no-op guard in `flush` swallow
  them and no binding would fire, leaving the scheme at its defaults on top of a running
  process — the worst failure mode here.

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

## Direct tag bindings (element value ← tag)

Besides JS bindings and `propertyRefs`, an element can follow a **tag** directly: a binding
with `direct: true` + `tag: "<path>"` and an empty `code`. `buildBindingIndex` routes it into
`directTagsByTagId`, and `flush` writes the value straight into the element's render prop
(`directTarget`, normally `value`) — the same bypass live table cells use, merged through
`runBindings`' `seedPropsByKey`. Consequences worth knowing:

- **The element needs no properties of its own.** The tag scope of a JS binding comes from the
  element's own tag properties; a direct tag binding skips that entirely, which is what makes
  "bind a tag to a progress bar" a two-click operation.
- **It is deliberately excluded from JS compilation** (`bindingIndex`): an empty-code binding
  in `all` would be re-run on every scheme change and counted in the bindings-problem chip.
- **It must seed on scheme change** alongside the table cells, or a scheme opened after the
  values already arrived would sit at its default forever — `flush` only reacts to *changed*
  tags.
- The tag value is taken **as percent 0-100** by the progress bar and merely clamped; there is
  no min/max scaling. A physical quantity must be normalised on the PLC side.
