/**
 * Контракт версионирования документов редактора (сцены и шаблоны).
 * Основание — «Изменения контракта для фронтенда: версии документов вместо отмены команд»
 * от 11.08.2026 (файл 2026-08-11-frontend-contract-changes.md в корне репозитория).
 *
 * Единица истории — документ целиком, а не действие: сервер никогда не видел
 * отдельных мелких правок, к нему всегда приезжает вся сцена.
 */

/** Ручное сохранение или автоматическое по таймеру.
 *  Различать обязательно: автосейв раз в 10 минут не должен попадать в «отменить последнее». */
export type SaveKind = "MANUAL" | "AUTOSAVE";

/** Виды версий в истории: сохранения плюс восстановление (оно дописывает историю, а не отматывает). */
export type VersionKind = SaveKind | "RESTORE";

/** Вид документа в пути новых эндпоинтов. Наш BFF ходит по /api/editor/history/{docType}/… */
export type VersionDocType = "scenes" | "templates";

/** Строка списка версий. `restored_from` есть только у kind === "RESTORE". */
export type VersionSummary = {
  version_no: number;
  kind: VersionKind;
  user_name: string;
  /** ISO date-time. Служит курсором для «показать ещё» (параметр `to`). */
  created_at: string;
  restored_from?: number;
};

/** Одна подмешанная сервером чужая правка. */
export type MergeChange = {
  user_name: string;
  /** Например "component", "component_property". */
  entity: string;
  /** Человекочитаемый путь, например "Клапан-1 / Уставка". */
  path: string;
  /** "ADDED" | "MODIFIED" | "DELETED" — список расширяемый, поэтому строка. */
  change: string;
};

/** Отчёт о слиянии: приходит в успешном ответе сохранения, когда сервер подмешал чужие правки. */
export type MergeReport = {
  base_version: number;
  merged_with_version: number;
  changes: MergeChange[];
};

export type ConflictKind = "BOTH_MODIFIED" | "DELETED_BY_THEM" | "DELETED_BY_YOU" | "BOTH_ADDED";

export type ConflictEntry = {
  kind: ConflictKind;
  entity: string;
  path: string;
  base?: string;
  yours?: string;
  theirs?: string;
  their_user?: string;
};

/**
 * Тело ответа 409.
 *
 * `conflicts` отсутствует на первом этапе выкатки бэкенда (простая проверка версии,
 * `error === "version_mismatch"`) и появляется, когда включится трёхстороннее слияние
 * (`error === "merge_conflict"`). Разрешение с нашей стороны в обоих случаях одинаковое:
 * показать расхождения, дать человеку решить и сохранить заново с
 * `based_on_version = current_version`. Поэтому обработка пишется ОДИН раз, а отсутствие
 * `conflicts` — не особый случай, а «расхождений не перечислено».
 */
export type SaveConflict = {
  error: "version_mismatch" | "merge_conflict" | string;
  base_version: number | null;
  current_version: number | null;
  conflicts?: ConflictEntry[];
};

/** Ошибка сохранения из-за расхождения версий. Отличается от обычной ошибки тем,
 *  что её показывает диалог сравнения, а не тост. */
export class SaveConflictError extends Error {
  readonly conflict: SaveConflict;

  constructor(conflict: SaveConflict) {
    super("Документ изменён другим пользователем");
    this.name = "SaveConflictError";
    this.conflict = conflict;
  }
}

/** `true`, если тело ответа похоже на 409-конверт версий. */
export const isSaveConflictBody = (body: unknown): body is SaveConflict =>
  typeof body === "object" &&
  body !== null &&
  ("current_version" in body || "conflicts" in body);

/**
 * Ответ сохранения сцены. `version_no` надо запомнить и прислать в `based_on_version`
 * при следующем сохранении. `components` принимаем как новое состояние дерева — тогда
 * заодно подхватываются присвоенные сервером id (обязательство §2: пришедший id обязан
 * вернуться тем же).
 *
 * `version_no: null` приходит от нашего BFF, когда бэкенд ещё отвечает старым голым
 * массивом (флаг EDITOR_SAVE_ENVELOPE выключен).
 */
export type SaveSceneResponse = {
  components: Record<string, unknown>[];
  version_no: number | null;
  merged?: MergeReport;
};

/**
 * Ответ восстановления версии, КАК ЕГО ПРИСЛАЛ сервер.
 *
 * Внимание: `components` здесь — документ целиком (объект сцены со вложенными
 * `children`), а не массив компонентов, как в ответе сохранения (§5 контракта,
 * «Форма ответа восстановления»). Имя поля одно, потому что конверт общий, поэтому
 * тип заведён отдельно от `SaveSceneResponse` — иначе разницу видно только в проде.
 */
export type RawRestoreResponse = {
  components: unknown;
  version_no: number | null;
  restored_from?: number;
};

/**
 * Ответ восстановления после нормализации (`rootComponentsOf`): наружу отдаём уже
 * массив корневых компонентов, чтобы вызывающий код рисовал версию тем же
 * `applyServerComponents`, которым рисует загрузку сцены.
 */
export type RestoreSceneResponse = {
  components: Record<string, unknown>[];
  version_no: number | null;
  restored_from?: number;
};

/**
 * Состояние режима просмотра старой версии (холст только для чтения).
 *
 * `versionNo: null` — версия открыта запросом «состояние на момент времени», а он
 * возвращает документ в обычной форме и номера версии может не содержать. Тогда
 * восстанавливать нечего (мы не знаем, ЧТО восстанавливать), и кнопка прячется —
 * это честнее, чем подставить 0 и восстановить не то.
 */
export type VersionPreview = {
  versionNo: number | null;
  kind: VersionKind;
  userName: string;
  createdAt: string;
  /** Момент времени, если версия открыта через `at?time=` — для подписи в плашке. */
  atTime?: string;
};

/** Параметры запроса списка версий. `kinds` уходит несколькими параметрами `kind`. */
export type VersionListQuery = {
  from?: string;
  to?: string;
  kinds?: VersionKind[];
  limit?: number;
};
