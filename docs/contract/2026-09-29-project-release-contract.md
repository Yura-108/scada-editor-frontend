# Выпуски проекта — изменения для фронта (29.09.2026)

Монитор рисует prod-выпуск, редактор правит черновик. Спека —
`docs/superpowers/specs/2026-09-29-project-releases-design.md`. Бэкенд — ветка
`feat/project-releases`.

## Монитор

| Было | Стало |
|---|---|
| `GET /api/editor/components/scenes?projectId=` | `GET /api/runtime/projects/{id}/scenes` → `[{id, name, project_id}]` |
| `GET /api/editor/components/{sceneId}?project_id=` | `GET /api/runtime/projects/{id}/scenes/{sceneId}` → тот же объект компонента |

Оба отвечают заголовком `X-Release-Version`; `409` — проект не в эксплуатации; `404` — сцены нет в
выпуске. `POST /api/runtime/sessions` отдаёт `versionNo`.

WS-кадр `{"type":"TREE_CHANGED","versionNo":n}`: сбросить кэш сцен (`sceneCache`), перечитать
список и текущую сцену; текущей нет — открыть первую. Сразу за ним приходит `SNAPSHOT` — обработать
как при подключении.

## Редактор

- «Выпустить»: `POST /api/editor/projects/{id}/versions {comment}` →
  `{version_no, created_at, comment, unchanged}`; `unchanged: true` — изменений с прошлого выпуска
  нет, показать «без изменений».
- Список выпусков: `GET /api/editor/projects/{id}/versions` (`version_no`, `user_name`,
  `created_at`, `comment`). Какой из них prod — `prodVersionNo` из
  `GET /api/editor/projects/{id}/runtime`.
- «Сделать prod»: `PUT /api/editor/projects/{id}/runtime/prod {versionNo}`; работающий проект
  переключится сам, мониторы получат `TREE_CHANGED`.
- Ввод в эксплуатацию без prod: `409 {error: "no_prod_release"}` — предложить выпустить.
- `POST /api/editor/projects/{id}/restore/{n}` не поддерживается (`400`).

## Пока фронт не обновлён

Монитор продолжает рисовать живое дерево из editor, логика идёт по prod — работает, но правки
редактора снова видны на экране, а кнопки новых компонентов не отвечают, пока их не выпустят.
Проекты, которые были в эксплуатации до обновления, получают выпуск №1 автоматически при старте
editor.
