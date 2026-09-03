import { clampZoom } from "@/lib/editor/zoomLimits";
import type { Camera } from "@/lib/editor/revealCamera";

/**
 * Положение камеры по сценам — в localStorage браузера.
 *
 * Камера это личное состояние ПРОСМОТРА, а не данные схемы. В документе сцены (рядом с
 * размером листа, в служебном элементе) она бы: помечала сцену несохранённой на каждое
 * движение мыши — `equality` у zundo сравнивает ссылку на `elements`, значит правка
 * элементов ещё и попадала бы в undo; требовала сохранения; и дёргала бы экран всем
 * остальным, кто открыл ту же сцену. Плата за localStorage — камера не переносится между
 * браузерами и устройствами.
 *
 * Один ключ на всё, как у раскладки редактора (`WorkSpace.tsx`, `scada-editor:layout`):
 * одна отложенная запись вместо записи на сцену.
 */

const LS_CAMERAS = "scada-editor:cameras";

/** Сколько сцен помним. Без ограничения запись росла бы бесконечно. */
const MAX_ENTRIES = 50;

/**
 * Редактор и монитор делят один стор и один холст, но не должны делить вид: оператор,
 * листающий мнемосхему, не должен сбивать инженеру то, на что тот смотрит в редакторе.
 */
export type CameraScope = "editor" | "monitor";

interface StoredCamera {
  x: number;
  y: number;
  zoom: number;
  /** Метка времени: по ней вытесняются самые старые записи при переполнении. */
  t: number;
}

type CameraStore = Record<string, StoredCamera>;

/**
 * Проект в ключе обязателен: `scene.id` — число от бэкенда, и в разных проектах
 * идентификаторы независимы.
 */
const keyOf = (
  scope: CameraScope,
  projectId: number | string | null | undefined,
  sceneId: number | string,
): string => `${scope}:${projectId ?? "-"}:${sceneId}`;

const readStore = (): CameraStore => {
  try {
    const raw = localStorage.getItem(LS_CAMERAS);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as CameraStore) : {};
  } catch {
    // Битый JSON, недоступное хранилище (приватный режим) — начинаем с чистого листа.
    return {};
  }
};

/** Камера сцены или null, если её не запоминали (или запись испорчена). */
export function readSceneCamera(
  scope: CameraScope,
  projectId: number | string | null | undefined,
  sceneId: number | string | null | undefined,
): Camera | null {
  if (sceneId == null) return null;

  const entry = readStore()[keyOf(scope, projectId, sceneId)];
  if (!entry) return null;

  // Устаревшая или испорченная запись не должна ломать холст: zoom 0 дал бы
  // невидимую сцену, NaN в x/y — пустой экран без единого элемента.
  if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y) || !Number.isFinite(entry.zoom)) {
    return null;
  }

  return { x: entry.x, y: entry.y, zoom: clampZoom(entry.zoom) };
}

/** Запоминает камеру сцены. Вызывать отложенно: пан пишет камеру на каждое движение мыши. */
export function writeSceneCamera(
  scope: CameraScope,
  projectId: number | string | null | undefined,
  sceneId: number | string | null | undefined,
  camera: Camera,
): void {
  if (sceneId == null) return;
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) {
    return;
  }

  const store = readStore();
  store[keyOf(scope, projectId, sceneId)] = {
    x: camera.x,
    y: camera.y,
    zoom: camera.zoom,
    t: Date.now(),
  };

  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    // Оставляем самые свежие: сцены, к которым давно не возвращались, забываются.
    keys
      .sort((a, b) => (store[b]?.t ?? 0) - (store[a]?.t ?? 0))
      .slice(MAX_ENTRIES)
      .forEach(k => delete store[k]);
  }

  try {
    localStorage.setItem(LS_CAMERAS, JSON.stringify(store));
  } catch {
    // Квота или приватный режим: камера просто не запомнится, работать это не мешает.
  }
}
