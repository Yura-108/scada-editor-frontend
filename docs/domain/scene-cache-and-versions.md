# Кэш сцен и версии документа

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Scene cache (fast scene switching)

`src/core/project/scenes/sceneCache.ts` keeps the **raw** `GET /api/editor/scene/{id}` response per
`(projectId, sceneId)` in tab memory; `loadScene` applies it through the same
`applyLoadedScene` → `applyServerComponents` path as a network load, so editor and runtime
behave identically either way. After `loadSceneList`, every scene of the project is prefetched
in the background (2 at a time, pinned tabs first, stops when the project changes).

- **The cached `version` is the base of that exact document** and becomes `sceneVersion` on a
  hit. It must be fetched *before* the scene request starts (`fetchSceneWithVersion`), so the
  document can only be newer than its number — the harmless direction (an extra server merge),
  never a silent overwrite. `undefined` = unknown, and such an entry is not a hit.
- A hit is revalidated in the background with `versions?limit=1`. Different number → refetch
  and swap quietly **only if the scene is untouched** (`!isDirty`, same `documentGeneration`);
  otherwise leave it and let the normal save-conflict path handle it.
- Whoever changes a scene on the server must update the cache: a successful save drops the
  entry and puts the tree from the response; restore does the same; `deleteScene` drops.
  `loadScene({keepHistory})` never reads the cache and uses `fresh` so it cannot pick up a
  background request started before the save. A request's result is not stored if the entry
  was written or dropped while it was in flight.
- Entries are cloned on read: `transformElements` reuses some input objects (bindings) by
  reference, so without the clone a store edit would leak into the cache.
- In development `loadScene` logs `[scene] … загрузка / распаковка / отрисовка` timings.

## Document versions (undo → versioning)

Contract: `docs/contract/frontend-contract-changes.md` (revision of 17.08.2026). The unit of history is the **whole scene**, not an action. Client-side Ctrl+Z (zundo) is unrelated and stays.

- **Save envelope.** `exportScene` sends `PUT {components, scene_id, based_on_version, save_kind}`. `save_kind` comes from an explicit `kind` option (`MANUAL` / `AUTOSAVE`) — never inferred from `silent`, which only means "no toast"; `"RESTORE"` is server-only and sending it is a 400. The BFF (`src/lib/saveEnvelope.ts` + `api/editor/components/route.ts`) forwards that `PUT` to the backend unchanged — one shape, no alternatives; the transitional `EDITOR_SAVE_ENVELOPE` flag that used to switch body *and* method has been removed along with the legacy `POST`-with-a-bare-array path. Responses are still normalized to `{components, version_no}` (`normalizeSaveResponse`), and a missing `version_no` is the signal that the response shape is not guaranteed — the store then reloads the scene instead of trusting the returned tree.
- **`PUT` means "here is the entire scene".** A component missing from the body is **deleted** by the backend. `buildComponentTree` already serializes every element of the scene, so this needs no diffing — but it also means there is deliberately **no out-of-band `DELETE`** any more: `deleteSelectedElement` and `ungroupSelected` only mutate local state and let the next save persist the removal. The BFF `DELETE` route is gone entirely — nothing called it. Consequence to keep in mind: a deletion that is never saved is a deletion that never happened.
- **`based_on_version`** comes from `sceneVersion`, learned via `GET …/versions?limit=1` (`refreshSceneVersion`) because the plain scene GET does not carry it today. When there are no versions the field is **omitted entirely** — sending it against a version-less scene is a 400.
- **409 is not an error path.** For a *manual* save it fills `saveConflict` and opens `SaveConflictDialog`; the canvas is untouched and `isDirty` stays true. One code path covers both `version_mismatch` (no `conflicts` list) and `merge_conflict` (with one); only the wording differs. **Merging only ever happens for `PUT` + `MANUAL`**, so an *autosave* 409 is routine and must not raise a modal: it sets `staleBaseVersion` (rendered by `StaleVersionBanner`) and deliberately leaves `sceneVersion` alone — advancing it would send the next manual save with someone else's base and overwrite their work without the merge dialog ever appearing. A `merged` block on a *successful* save must be surfaced (`reportMergedChanges`) **even when `changes` is empty** — the empty case still means the save landed on top of a newer version. In conflict rows, `path === "Сцена"` is a reserved address for a top-level ordering conflict, not a component of that name (`formatConflictPath`).
- **A script that does not parse fails the whole save** (400, backend since 25.09.2026; `scripts[].script`, `events[].script`, binding `code`, `properties[].onChange`, all parsed as a *function body*). The editors check first with `checkScriptSyntax` (`lib/runtime/scriptSyntax.ts`, `new Function` — parses, never runs) and disable «Сохранить»; `OnCanChange` only warns, the backend does not check it. Component scripts are **JavaScript** (GraalJS on the server), not Java, whatever old labels said. A failed *autosave* keeps its reason in `autosaveError`: toast only when the reason changes, then `AutosaveErrorBanner` — otherwise the same 400 would toast every 10 minutes. Any successful save or document switch clears it; «Скрыть» is local to the banner so the next tick does not re-toast.
- **Document shape differs between endpoints.** The save response puts an *array* in `components`; the restore response puts the *whole document* there, and a plain document GET uses `children`. `rootComponentsOf` (`src/core/project/versions/documentComponents.ts`) is the single place that resolves all three — reading `components` with `Array.isArray` on a restore response silently yields `[]` and wipes the canvas.
- **Someone else's save is announced over STOMP** (`useSceneChangedNotifications`, mounted once in
  `EditorClient`): SockJS `/ws/editor` via the gateway, topic `/topic/scenes/{sceneId}` for the open
  draft scene, body `{type: "SCENE_CHANGED", scene_id, version_no, user_name}`. It is a notice, not
  sync. Whether to show it is *derived* (`visibleSceneChange`): only for the open scene, only when
  `version_no > sceneVersion` (that is how our own save is filtered — `PUT` writes its version there),
  and never while `isSaving` (our own message can beat the `PUT` response). `SceneChangedBanner`'s
  «Перезагрузить» drops the scene-cache entry and reloads, asking first about unsaved work; in
  `versionPreview` there is no button. The old catalog STOMP (`/ws`, `/topic/device-tree/…`) was dead
  on both sides and has been removed.
- **History endpoints** are proxied under `/api/editor/history/{scenes|templates}/{id}/…` (`src/lib/editorHistoryProxy.ts`). `docType` is whitelisted because it is interpolated into the backend URL; `kind` may repeat, so use `getAll`. Paging uses a `to = created_at` cursor, never an offset.
- **Version preview** reuses `Canvas readOnly` (the monitor's path). Entering stashes live state in a module var, pauses `temporal`, and marks the scene saved so the dirty flag describes the version, not the user's work; exiting restores everything including `savedElementsSnapshot`. **Anything that can mutate or persist must bail on `versionPreview`** — `exportScene`, the autosave tick, the properties panel, and the unload warning (`hasUnsavedWork`, which reads the stash) all do. Crossing a document boundary (`loadScene`, `createScene`, `deleteScene`, `setCurrentProject`) calls `discardVersionPreview`, which drops the stash rather than restoring it into a different scene.
