import {
  isSaveConflictBody,
  type MergeReport,
  type SaveConflict,
  type SaveKind,
} from "@/types/editorVersion.types";

export interface SaveSceneRequest {
  /** Весь состав сцены (`buildComponentTree`): удалённое исчезает по отсутствию. */
  components: unknown[];
  sceneId: number;
  kind: SaveKind;
  /** null — версий ещё нет (первое сохранение), поле не отправляем. */
  basedOnVersion: number | null | undefined;
}

export type SaveSceneResult =
  | {
      kind: "saved";
      /** Дерево из ответа; пустое, если бэкенд его не прислал. */
      components: Record<string, unknown>[];
      /** null — ответ не по контракту, его дереву холст не доверяет. */
      versionNo: number | null;
      merged: MergeReport | null;
    }
  /** 409: сцену успел сохранить кто-то ещё. Это не ошибка — правки целы. */
  | {kind: "conflict"; conflict: SaveConflict}
  | {kind: "failed"; status: number; text: string};

/**
 * Сохранение сцены: `PUT /api/editor/components` с конвертом
 * `{components, scene_id, save_kind, based_on_version?}`.
 *
 * `PUT`, а не `POST`: `POST` только создаёт компоненты и не принимает `scene_id`, а
 * слияние чужих правок сервер делает исключительно для `PUT` с `save_kind: "MANUAL"`.
 */
export async function requestSaveScene(
  {components, sceneId, kind, basedOnVersion}: SaveSceneRequest,
): Promise<SaveSceneResult> {
  const res = await fetch("/api/editor/components", {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      components,
      scene_id: sceneId,
      save_kind: kind,
      // Версий нет — это первое сохранение, и поле не отправляем вовсе
      // (прислать его при отсутствующих версиях — 400 по контракту).
      ...(basedOnVersion != null ? {based_on_version: basedOnVersion} : {}),
    }),
  });

  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    const conflict: SaveConflict = isSaveConflictBody(body)
      ? body
      : {error: "version_mismatch", base_version: basedOnVersion ?? null, current_version: null};
    return {kind: "conflict", conflict};
  }

  if (!res.ok) {
    return {kind: "failed", status: res.status, text: await res.text()};
  }

  const saved = await res.json().catch(() => null);
  return {
    kind: "saved",
    components: Array.isArray(saved?.components) ? saved.components : [],
    versionNo: typeof saved?.version_no === "number" ? saved.version_no : null,
    merged: saved?.merged ? saved.merged as MergeReport : null,
  };
}
