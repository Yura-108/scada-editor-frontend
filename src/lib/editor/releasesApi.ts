import {fetchVersions} from "@/lib/editor/versionsApi";
import type {VersionSummary} from "@/types/editorVersion.types";

/**
 * Выпуски проекта (контракт docs/contract/2026-09-29-project-release-contract.md).
 *
 * Редактор правит черновик, монитор и runtime крутят prod-выпуск. Выпуск — неизменяемый снимок
 * всего проекта; «Сделать prod» переключает работающий проект горячо, мониторы получают
 * `TREE_CHANGED`. Отката проекта к выпуску нет (`restore/{n}` → 400).
 */

/** Ответ «Выпустить». `unchanged` — с прошлого выпуска ничего не менялось, вернулся прежний. */
export interface CreatedRelease {
  version_no: number;
  created_at: string;
  comment: string | null;
  unchanged: boolean;
}

/** Состояние эксплуатации проекта: `GET|PUT /api/editor/projects/{id}/runtime[/prod]`. */
export interface ProjectRuntimeInfo {
  inOperation: boolean;
  /** null — prod не назначен, ввести в эксплуатацию нельзя (`no_prod_release`). */
  prodVersionNo: number | null;
}

/** Ввод в эксплуатацию без prod-выпуска: `409 {error: "no_prod_release"}`. */
export class NoProdReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoProdReleaseError";
  }
}

const failure = async (res: Response, fallback: string): Promise<Error> => {
  const text = await res.text().catch(() => "");
  let body: {message?: unknown; error?: unknown} | null = null;
  try { body = JSON.parse(text); } catch { /* не JSON */ }
  if (res.status === 409 && body?.error === "no_prod_release") {
    return new NoProdReleaseError(typeof body.message === "string" && body.message
      ? body.message
      : "У проекта нет prod-выпуска");
  }
  const message = typeof body?.message === "string" && body.message ? body.message : text;
  return new Error(message ? `${fallback}: ${message}` : `${fallback} (${res.status})`);
};

export const parseRuntimeInfo = (data: unknown): ProjectRuntimeInfo | null => {
  const d = data as {inOperation?: unknown; prodVersionNo?: unknown} | null;
  if (typeof d?.inOperation !== "boolean") return null;
  const prod = typeof d.prodVersionNo === "number" && Number.isSafeInteger(d.prodVersionNo)
    ? d.prodVersionNo
    : null;
  return {inOperation: d.inOperation, prodVersionNo: prod};
};

/** Выпуски проекта, свежие первыми. «Показать ещё» — `to = created_at` последней строки. */
export const fetchReleases = (projectId: number, opts: {to?: string; limit?: number} = {}): Promise<VersionSummary[]> =>
  fetchVersions("projects", projectId, opts);

/** Выпустить текущий (сохранённый на сервере) черновик проекта. */
export async function createRelease(projectId: number, comment: string): Promise<CreatedRelease> {
  const res = await fetch(`/api/editor/projects/${projectId}/versions`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({comment}),
  });
  if (!res.ok) throw await failure(res, "Не удалось выпустить проект");
  return await res.json() as CreatedRelease;
}

/** Сделать выпуск prod. Работающий проект переключится сам. */
export async function setProdRelease(projectId: number, versionNo: number): Promise<ProjectRuntimeInfo> {
  const res = await fetch(`/api/editor/projects/${projectId}/runtime/prod`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({versionNo}),
  });
  if (!res.ok) throw await failure(res, "Не удалось сделать выпуск prod");
  const info = parseRuntimeInfo(await res.json().catch(() => null));
  return info ?? {inOperation: false, prodVersionNo: versionNo};
}

/** Ввести в эксплуатацию или вывести. 409 `no_prod_release` — NoProdReleaseError. */
export async function putInOperation(projectId: number, inOperation: boolean): Promise<ProjectRuntimeInfo> {
  const res = await fetch(`/api/editor/projects/${projectId}/runtime`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({inOperation}),
  });
  if (!res.ok) throw await failure(res, "Ошибка переключения эксплуатации");
  const info = parseRuntimeInfo(await res.json().catch(() => null));
  return info ?? {inOperation, prodVersionNo: null};
}
