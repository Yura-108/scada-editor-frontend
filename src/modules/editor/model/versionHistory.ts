import {toast} from "sonner";
import type {VersionSummary} from "@/types/editorVersion.types";

/**
 * Ближайшее ручное сохранение старше того, что лежит на холсте, — для «Вернуться к
 * предыдущему сохранению». `all` — история всех видов, свежие первыми; `null` — такого нет.
 *
 * Нужны ВСЕ виды, а не только MANUAL: чтобы понять, «предыдущее» относительно чего искать,
 * надо увидеть и записи RESTORE. Список, отфильтрованный по MANUAL, после восстановления не
 * меняется вовсе — по нему шаг назад всегда упирался бы в одну и ту же версию.
 */
export function findPreviousManualVersion(
  all: VersionSummary[],
  sceneVersion: number | null,
): VersionSummary | null {
  if (!all.length) return null;

  // Что лежит на холсте сейчас. sceneVersion может отставать (бэкенд не всегда
  // отдаёт version_no) — тогда берём самую свежую запись истории.
  const head = all.find(v => v.version_no === sceneVersion) ?? all[0];

  // Для RESTORE содержимое равно версии-источнику: шаг назад надо делать от неё,
  // иначе «отменить отмену» вернуло бы ту же самую версию по кругу.
  const contentVersion =
    head.kind === "RESTORE" && head.restored_from != null ? head.restored_from : head.version_no;

  // Список свежие-первыми, поэтому первая подходящая строка — ближайшая старшая.
  return all.find(v => v.kind === "MANUAL" && v.version_no < contentVersion) ?? null;
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
      description: "На холсте содержимое версии " + restoredFrom +
        ". Если это повторяется, история версий на сервере отдаёт не тот снимок.",
      duration: 12_000,
    });
  } else if (!trustResponse) {
    toast.warning(`Версия ${versionNo} восстановлена, схема перечитана с сервера`, {
      description: "Ответ восстановления пришёл в неожиданном виде, поэтому холсту он не доверен.",
      duration: 10_000,
    });
  } else {
    toast.success(`Восстановлена версия ${versionNo}`);
  }
}
