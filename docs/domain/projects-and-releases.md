# Проекты: выпуски и закреплённые сцены

> Перенесено из CLAUDE.md без изменений. Держите в актуальном состоянии при правках этой области.

## Project releases: the monitor shows prod, the editor edits the draft

Contract: `docs/contract/2026-09-29-project-release-contract.md` (backend: `ProjectReleaseController`,
`ProjectRuntimeController`, runtime `ProjectScenesController`, `TreeChangedMessage`). A release is an
immutable snapshot of the whole project; runtime executes the **prod** release and the monitor must
draw exactly it, not the editor's draft.

- **`sceneSource` in the store** (`"draft" | "release"`) decides where `loadSceneList`/`loadScene`
  read from. `MonitorClient` sets `release` on mount and `draft` on unmount. It is a flag rather than
  separate monitor actions because the monitor also opens scenes from scripts
  (`openSceneFromScript`) and tabs — any path without the flag would show the draft.
- **Switching source stashes the editor document** (`draftStash`: scene, list, elements, dirty flag,
  `sceneVersion`, saved snapshot) and restores it on the way back if the project is unchanged. Without
  it, entering the monitor would wipe unsaved work, and returning would leave the release in the
  editor for the next save to write over the draft. `hasUnsavedWork` reads the stash while in the
  monitor.
- **The scene cache keys by source** (`release:…` vs `draft:…`). Release entries carry
  `releaseVersion` (header `X-Release-Version`), have `version: null` (the monitor never saves) and
  are never revalidated — they are dropped wholesale by `dropReleaseScenes` on `TREE_CHANGED`.
- **`TREE_CHANGED`** (and a different `versionNo` on a new session after a reconnect) →
  `reloadRelease`: re-read the list, reopen the current scene or the first one. The `SNAPSHOT` that
  follows goes through the usual path; the new `elements` rebuild the binding index.
- Release responses: 409 = project not in operation (`releaseError`, shown on the canvas, not a
  toast); 404 on a scene = not in this release (toast, the shown scene stays). The BFF must forward
  `X-Release-Version` (`passThroughRelease`) — `passThrough` drops headers.
- Editor: «Выпуски» (`ReleasesModal`, from the project list row in the editor bar — `modules/editor/ui/project-bar/ProjectRowActions` — and `ToolsPanel`) — release the **saved**
  draft (unsaved work is offered to be saved first; `unchanged: true` = nothing changed since the last
  release), list them (the generic versions API with doc type `projects`), make one prod. Enabling
  operation without prod answers 409 `no_prod_release`; the store offers to release, make prod and
  retry. Project restore (`restore/{n}`) is not supported by the backend and never called.

## Pinned scenes are a project setting

Contract: `docs/contract/2026-09-30-project-image-contract.md` (accepted by the backend as is).
Pinned tabs live in the project's `image` as `pinnedScenes: {v: 1, ids, recipesIndex}`, shared by
every user of the project. The image is **read from the project list only**
(`GET /api/editor/components/projects` returns `image` per project, always present, `null` when
empty) and **written** with `PUT /api/editor/projects/{id}/image` — an opaque JSON, no document
versions, no release (`src/lib/editor/projectSettingsApi.ts`). The backend keeps it in its own
column (`editor.project_runtime.image`), not in the project's states, so it is **not** in
`GET /components/{projectId}` nor in a release tree. Limit: 16 KB serialized (400 above that).

- **Only the editor changes them** (`usePinnedScenesStore` bails unless `sceneSource === "draft"`);
  the monitor renders `SceneTabs editable={false}` and has no pin button.
- **localStorage is a cache and a fallback**: `hydrate` shows the cache instantly, then adopts the
  server list; a project list without the `image` field, or 404/405/501 on the write, means the
  backend is not updated yet — `supported: false` and everything
  stays local, as before. When the server has no `pinnedScenes` yet, the first engineer to open the
  project in the editor uploads their local pins.
- A write re-reads the image and merges only its own key (`saveProjectSetting`); a failed write
  rolls the tabs back. `hydrate` also runs on `visibilitychange` so a colleague's change shows up
  without a reload. A pinned id missing from `sceneList` (deleted, or not in the prod release) is
  simply not shown.
