import type {SceneType} from "@/types/editorElement.type";
// переедут в core/scene вместе с остальным lib (шаг 8)
import {releaseVersionOf, type SceneSource} from "@/lib/editor/sceneCache";

export interface SceneListItem {
  id: number;
  name: string;
}

export type SceneListResult =
  | {kind: "list"; list: SceneListItem[]; releaseVersion: number | null}
  /** 409 у выпуска: проект не в эксплуатации — это состояние экрана, а не сбой. */
  | {kind: "notInOperation"; message: string};

/**
 * Список сцен проекта. Монитор (`release`) берёт схемы prod-выпуска, редактор (`draft`) —
 * черновика. У выпуска заодно приходит номер выпуска в `X-Release-Version`.
 */
export async function requestSceneList(projectId: number, source: SceneSource): Promise<SceneListResult> {
  const res = await fetch(source === "release"
    ? `/api/runtime/projects/${projectId}/scenes`
    : `/api/editor/scene?project_id=${projectId}`);

  if (source === "release" && res.status === 409) {
    const body = await res.json().catch(() => null) as {message?: string} | null;
    return {kind: "notInOperation", message: body?.message || "Проект не в эксплуатации — выпуск не исполняется"};
  }
  if (!res.ok) {
    throw new Error(await res.text().catch(() => "Ошибка загрузки списка сцен"));
  }

  const json = await res.json();
  return {
    kind: "list",
    list: Array.isArray(json) ? json : [],
    releaseVersion: source === "release" ? releaseVersionOf(res) : null,
  };
}

/** Новая сцена в проекте. */
export async function requestCreateScene(name: string, projectId: number): Promise<SceneType> {
  const payload = {name, project_id: projectId};

  const res = await fetch("/api/editor/scene", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ошибка ${res.status}: ${text}`);
  }

  return res.json();
}
