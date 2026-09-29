import {fetchCurrentVersion} from "@/lib/editor/versionsApi";

/**
 * Кэш сцен в памяти вкладки: переход между схемами не должен каждый раз ждать, пока
 * бэкенд соберёт всё дерево компонентов (1–3 с на схему).
 *
 * Хранится СЫРОЙ ответ `GET /api/editor/scene/{id}`, а не `elements`: распаковка
 * остаётся общим путём `applyServerComponents`, и после чтения из кэша редактор и
 * рантайм ведут себя ровно как после обычной загрузки.
 *
 * `version` — номер версии ИМЕННО этого документа. На нём держится проверка свежести
 * (`versions?limit=1` против него) и `based_on_version` следующего сохранения, поэтому
 * правило одно: номер получен ДО того, как начался запрос самой сцены. Тогда документ
 * бывает только новее номера, и худший исход — лишнее слияние на сервере, а не молча
 * затёртая чужая правка. `undefined` — номер неизвестен, такая запись попаданием не
 * считается.
 *
 * Живёт до перезагрузки страницы — сознательно: между сессиями схема могла измениться
 * как угодно, а проверять её всё равно пришлось бы.
 */

/**
 * Откуда схема: черновик редактора или prod-выпуск, который рисует монитор (контракт
 * docs/contract/2026-09-29-project-release-contract.md). Редактор и монитор — одна вкладка и
 * один кэш, поэтому источник входит в ключ: иначе монитор показал бы черновик из кэша
 * редактора, а редактор — выпуск, и сохранение затёрло бы правки старым деревом.
 */
export type SceneSource = "draft" | "release";

export interface CachedScene {
  /** Ответ сервера как есть (`{id, name, project_id, children, …}`). */
  scene: Record<string, unknown>;
  /**
   * Номер версии СЦЕНЫ (черновика) — база следующего сохранения. У выпуска `null`: монитор не
   * сохраняет, а запись без номера (`undefined`) попаданием не считается.
   */
  version: number | null | undefined;
  /** Номер выпуска проекта (`X-Release-Version`) — только у `release`. */
  releaseVersion?: number | null;
}

/** Ответ сервера с кодом — стор различает 404 («нет в выпуске») и 409 («не в эксплуатации»). */
export class SceneLoadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SceneLoadError";
  }
}

const entries = new Map<string, CachedScene>();
const inflight = new Map<string, Promise<CachedScene>>();
/** Счётчик записей по ключу: по нему летящий запрос узнаёт, что его ответ уже устарел. */
const writes = new Map<string, number>();

const keyOf = (projectId: number | string, sceneId: number | string, source: SceneSource = "draft") =>
  `${source}:${projectId}:${sceneId}`;

/** Номер выпуска из заголовка ответа; нет или мусор — null. */
export const releaseVersionOf = (res: Response): number | null => {
  const raw = res.headers.get("X-Release-Version");
  const n = raw == null ? NaN : Number(raw);
  return Number.isSafeInteger(n) ? n : null;
};
const bump = (key: string) => writes.set(key, (writes.get(key) ?? 0) + 1);

/**
 * Запись из кэша — КОПИЕЙ. `transformElements` местами кладёт в элементы исходные
 * объекты (привязки по ссылке), и без копии правка в сторе меняла бы кэш, а следующее
 * открытие схемы показало бы её как серверную.
 */
export function getCachedScene(
  projectId: number | string,
  sceneId: number | string,
  source: SceneSource = "draft",
): CachedScene | null {
  const entry = entries.get(keyOf(projectId, sceneId, source));
  return entry
    ? {scene: structuredClone(entry.scene), version: entry.version, releaseVersion: entry.releaseVersion}
    : null;
}

/** Запись черновика (сохранение, восстановление версии пишут именно черновик). */
export function putScene(
  projectId: number | string,
  scene: Record<string, unknown>,
  version: number | null | undefined,
): void {
  if (scene?.id == null) return;
  const key = keyOf(projectId, scene.id as number);
  entries.set(key, {scene: structuredClone(scene), version});
  bump(key);
}

export function dropScene(projectId: number | string, sceneId: number | string): void {
  const key = keyOf(projectId, sceneId);
  entries.delete(key);
  bump(key);
}

/**
 * Сбросить все схемы выпуска проекта — prod сменился (кадр `TREE_CHANGED`). Черновик не
 * трогаем: смена выпуска его не меняет.
 */
export function dropReleaseScenes(projectId: number | string): void {
  const prefix = `release:${projectId}:`;
  for (const key of [...entries.keys()]) {
    if (!key.startsWith(prefix)) continue;
    entries.delete(key);
    bump(key);
  }
  for (const key of [...inflight.keys()]) if (key.startsWith(prefix)) bump(key);
}

/**
 * Номер версии, а затем сама сцена — в этом порядке (см. правило в шапке), и результат
 * сразу в кэш. Номер не получен — `undefined`: схему всё равно показываем, без него
 * редактор работает, а попаданием такая запись не считается.
 *
 * Общим на ключ сделан весь запрос-ПАРА, а не одна сцена: клик по схеме, которая уже
 * грузится в фоне, дожидается того же ответа. Подхватить только фоновый запрос сцены под
 * свой, более поздний номер было бы нельзя — документ оказался бы старше номера, и
 * сохранение затёрло бы чужую правку без слияния.
 *
 * `fresh` — не подхватывать уже летящий запрос. Нужен там, где важно состояние сервера
 * ПОСЛЕ какого-то события (перечитывание после сохранения, проверка свежести): фоновый
 * запрос, начатый раньше, вернул бы документ до него.
 */
export function fetchSceneWithVersion(
  projectId: number,
  sceneId: number,
  {fresh = false, source = "draft"}: {fresh?: boolean; source?: SceneSource} = {},
): Promise<CachedScene> {
  const key = keyOf(projectId, sceneId, source);
  const pending = fresh ? undefined : inflight.get(key);
  if (pending) return pending;

  const writesAtStart = writes.get(key) ?? 0;

  const request = (async (): Promise<CachedScene> => {
    // Выпуск неизменяем и не сохраняется — номер версии сцены ему не нужен; его номер
    // выпуска приходит заголовком того же ответа.
    const version = source === "release"
      ? null
      : await fetchCurrentVersion("scenes", sceneId).catch(() => undefined);
    const res = await fetch(source === "release"
      ? `/api/runtime/projects/${projectId}/scenes/${sceneId}`
      : `/api/editor/scene/${sceneId}?project_id=${projectId}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = text;
      try { message = JSON.parse(text)?.message || text; } catch { /* не JSON */ }
      throw new SceneLoadError(`Ошибка ${res.status}: ${message}`, res.status);
    }
    const releaseVersion = source === "release" ? releaseVersionOf(res) : undefined;
    const scene = await res.json() as Record<string, unknown>;
    const entry: CachedScene = {scene, version, ...(source === "release" ? {releaseVersion} : {})};
    // Пока летел запрос, запись могли обновить (сохранение) или удалить (удаление
    // схемы, смена выпуска) — тогда наш ответ старше того, что знает кэш, и класть его нельзя.
    if ((writes.get(key) ?? 0) === writesAtStart && scene?.id != null) {
      entries.set(key, {...entry, scene: structuredClone(scene)});
      bump(key);
    }
    return entry;
  })().finally(() => {
    // Свежий запрос мог занять слот чужого — удаляем только свой.
    if (inflight.get(key) === request) inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}

const PREFETCH_CONCURRENCY = 2;

/**
 * Фоновая загрузка схем проекта, чтобы и ПЕРВЫЙ переход на схему был быстрым.
 *
 * По две одновременно — бэкенд собирает дерево тяжело, и залп из всех схем разом
 * замедлил бы ту, которую пользователь как раз открывает. `isRelevant` проверяется
 * перед каждым запросом: сменили проект — очередь старого останавливается.
 * Ошибки молча в консоль: этого запроса пользователь не делал.
 */
export async function prefetchScenes(
  projectId: number,
  sceneIds: number[],
  isRelevant: () => boolean,
  source: SceneSource = "draft",
): Promise<void> {
  const queue = sceneIds.filter(id => !entries.has(keyOf(projectId, id, source)));

  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (!isRelevant()) return;
      if (entries.has(keyOf(projectId, id, source))) continue;
      try {
        // В кэш кладёт сам запрос — и не кладёт, если запись тем временем обновили.
        await fetchSceneWithVersion(projectId, id, {source});
      } catch (err) {
        console.warn(`[scene-cache] схема ${id} не загрузилась в фоне:`, err);
      }
    }
  };

  await Promise.all(Array.from({length: PREFETCH_CONCURRENCY}, worker));
}
