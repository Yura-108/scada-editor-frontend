import { toast } from 'sonner';
import { fetchVersions, type VersionSummary } from '@/core/project';

/**
 * После «Восстановить» из истории возвращаем состояние до операции.
 * Повторный шаг с панели идёт к более раннему ручному сохранению.
 */
export function findPreviousVersion(
  page: VersionSummary[],
  head: VersionSummary,
  returnedFromToolbar: boolean,
): VersionSummary | null {
  if (head.kind === 'RESTORE' && !returnedFromToolbar) {
    return page.find((v) => v.version_no < head.version_no) ?? null;
  }
  let contentVersion = head.restored_from ?? head.version_no;
  for (const version of page) {
    if (
      version.version_no === contentVersion &&
      version.kind === 'RESTORE' &&
      version.restored_from != null &&
      version.restored_from < contentVersion
    ) {
      contentVersion = version.restored_from;
    }
    if (version.kind === 'MANUAL' && version.version_no < contentVersion) return version;
  }
  return null;
}

const returnVersions = new Map<number, number>();
const returnKey = (sceneId: number) => `scada-editor:return-version:${sceneId}`;

/** Сервер помечает оба действия как RESTORE. Вкладка помнит, какой шаг был сделан с панели. */
export function rememberReturnedVersion(sceneId: number, versionNo: number): void {
  returnVersions.set(sceneId, versionNo);
  try {
    window.sessionStorage.setItem(returnKey(sceneId), String(versionNo));
  } catch {
    // Если хранилище недоступно, повторный шаг работает до перезагрузки вкладки.
  }
}

function wasReturnedFromToolbar(sceneId: number, versionNo: number): boolean {
  const inMemory = returnVersions.get(sceneId);
  if (inMemory != null) return inMemory === versionNo;
  try {
    return window.sessionStorage.getItem(returnKey(sceneId)) === String(versionNo);
  } catch {
    return false;
  }
}

export async function loadPreviousVersion(sceneId: number, limit: number) {
  let page = await fetchVersions('scenes', sceneId, { limit });
  const head = page[0];
  if (!head) return { head: null, previous: null };
  const returnedFromToolbar = wasReturnedFromToolbar(sceneId, head.version_no);
  const history: VersionSummary[] = [];
  let cursor: string | undefined;
  while (page.length) {
    history.push(...page);
    const previous = findPreviousVersion(history, head, returnedFromToolbar);
    if (previous) return { head, previous };
    const nextCursor = page.at(-1)?.created_at;
    if (page.length < limit || !nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
    page = await fetchVersions('scenes', sceneId, { limit, to: cursor });
  }
  return { head, previous: null };
}

/**
 * Тост по итогу восстановления версии.
 *
 * `restored_from` называет версию, которую сервер ВЗЯЛ за источник. Расхождение
 * с запрошенной означает, что восстановлено не то, — и без этой проверки такой
 * ответ неотличим от успеха: тост бодро называет запрошенный номер, а на холсте
 * чужое содержимое.
 */
export function reportRestoreOutcome(
  versionNo: number,
  restoredFrom: number | null | undefined,
  trustResponse: boolean,
): void {
  if (restoredFrom != null && restoredFrom !== versionNo) {
    toast.warning(`Сервер восстановил версию ${restoredFrom}, а не ${versionNo}`, {
      description:
        'На холсте содержимое версии ' +
        restoredFrom +
        '. Если это повторяется, история версий на сервере отдаёт не тот снимок.',
      duration: 12_000,
    });
  } else if (!trustResponse) {
    toast.warning(`Версия ${versionNo} восстановлена, схема перечитана с сервера`, {
      description: 'Ответ восстановления пришёл в неожиданном виде, поэтому холсту он не доверен.',
      duration: 10_000,
    });
  } else {
    toast.success(`Восстановлена версия ${versionNo}`);
  }
}
