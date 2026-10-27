# Тренды и режим «Архив»

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Trends: pens are tag properties, data comes from the tag archive

Contract: `docs/contract/2026-09-28-tag-archive-contract.md` (all sections implemented; the
operator action journal, section 5, is the read-only `/actions` page — `GET /api/runtime/actions`
returns a bare array with no total, so "more" means "the last page was full").

- **A pen is a tag property** of the `trend` element (`property_type === "Тег"`, name `pen1`,
  `pen2`, …). Its look lives in `element.trend` (`{window, step, min, max, pens: {<name>: {color,
  width, k}}}`) — a base key like `monitorMenu`: in `BASE_ONLY_KEYS`, in `STRUCTURAL_KEYS` of
  `transformElements`, restored from the default image (composition descriptors too), clamped by
  `readTrendSettings` (`core/scene/element/trendSettings.ts`). A `pens` entry without a property is
  ignored.
- **One Y axis per trend** (`docs/contract/2026-09-29-trend-common-scale-contract.md`): `trend.min/max`
  is the common scale (a missing bound is auto over all pens), and a pen's `k` and `b` bring its
  units to that scale — the chart, axis, hover and legend all show `value × k + b` (the old SCADA's
  `SetStairs(tag, field, k, b, 0)`; `b` lifts discrete 0/5 steps apart and a negative-`k` pen above
  the axis). The archive and WS stay raw.
  Per-pen `min/max` used to exist and made the axis lie (it was labelled by the first pen); they are
  no longer read, so they disappear from a scene on its next save. `k` of 0 or non-numeric means 1;
  `b` of 0 is not stored.
- **Drawn as steps**, never sloped lines: the archive stores only changes, so the value holds until
  the next point. `null` is a gap (bad quality). `lib/editor/trendGeometry.ts` is the single pure
  implementation, shared by the Konva shape and the monitor's SVG `TrendModal`.
- **Monitor data**: `useTrendStore` holds series only for tags in `watched` (pens of the open
  scene). `useRuntimeEngine` sets `watched` and loads `[now − window, now]` from
  `GET /api/runtime/archive/values` on every `index` change, and appends WS points in
  `onSnapshot`/`onUpdate` **directly, not through `pendingRef`/`flush`** — coalescing would merge
  two changes inside one flush tick. `TrendShapeElement` treats "my pens are watched" as "I am in
  the monitor"; there is no readOnly flag in the render context.
- **The operator's changes are local**: `TrendModal` (opened by «Открыть тренд» in the monitor
  menu; trends get no «Опции») keeps window, scale, hidden pens and the rewind position in its own
  state and issues its own archive requests. Nothing is saved.
- `fetchArchiveValues` (`lib/runtime/archive.ts`) splits tags into batches of 20 and clamps `from`
  to the 30-day archive depth — the backend answers 400 to the whole request otherwise.
- **Every archive request carries the monitor's `projectId` in the query** (contract
  `docs/contract/2026-10-19-archive-project-id-contract.md`) — `values` and `replay` alike, and for
  `replay` **only** in the query, never the body (the owner's access check reads the query). Runtime
  forwards it to the instance that owns the project and checks tags against *that* prod release;
  without it a project on another runtime instance gets 403. The BFF routes re-validate it (digits,
  > 0) and pass it on. A 409 from the archive is retried once (`fetchArchive`): the project's
  assignment changed mid-request.
- The `logging` checkbox is gone from the property form (the archive records every tag), but the
  field still travels with the property: the backend has not dropped it yet.

## Monitor «Архив» mode: replaying a scene from the tag archive

`useRuntimeEngine(active, mode)` has two value sources. In `"archive"` mode the WS is never
opened, no bus handlers are registered (clicks run nothing), and `Canvas archive` skips
`MonitorInteractionLayer` and reduces the menu to «Открыть тренд». The player
(`useArchiveReplay`, mounted **once** in `MonitorClient`; state in `useArchiveReplayStore`,
pure buffer logic in `lib/runtime/replayBuffer.ts`) feeds `engine.archive.reset/apply`, which
go through `pendingRef` + synchronous `flush` exactly like `onSnapshot` — so bindings draw the
scheme as usual.

- **Archive values are converted back to the WS form** (`archiveValueToWire`). WS carries the
  gateway's raw string (`"true"`/`"false"` for bools), the archive stores `Boolean` as 1.0/0.0
  (backend `ArchiveRecorder.toPoint`), so a binding comparing with `"true"` would silently fail.
  A tag counts as bool if it arrived as `"true"`/`"false"` over WS in this tab, or its property
  has a boolean `value_type`.
- **Seeking**: forward inside the loaded feed just applies up to the new point; backwards or past
  it re-requests with `from` = the seek point (`initial` exists only on the first page). The
  engine is reset only when the new first page has arrived, so the scheme never goes blank.
- **The cursor never outruns the loaded feed** (`advanceCursor`): the backend pages by
  `(ts, tag)`, so the feed is complete only up to *before* the last loaded `ts`.
- **Trends follow the cursor**: `useTrendStore.clockTs` replaces `Date.now()` as "now", and
  `archive.reset` clears the series (bumping `generation`, which `TrendModal` watches) and reloads
  trend history around the cursor.
- Server-script property writes (`properties[]`) are not archived; bindings that depend on them do
  not fire in the archive. Leaving archive mode resets everything, and the WS `SNAPSHOT` restores
  the live scheme.
