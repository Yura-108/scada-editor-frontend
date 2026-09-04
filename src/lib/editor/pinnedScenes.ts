/**
 * Закреплённые схемы — в localStorage браузера.
 *
 * Это личная настройка рабочего места, а не данные проекта: закрепление не должно ни
 * помечать что-либо несохранённым, ни ехать на сервер, ни навязываться остальным.
 * Конвенции те же, что у положения камеры (`sceneCamera.ts`): один ключ на всё,
 * `try/catch` на чтении и записи, валидация значений на чтении, ограниченный размер.
 */

const LS_PINS = "scada-editor:pinned-scenes";

/** Сколько схем можно закрепить в одном проекте: шире полоса вкладок всё равно не нужна. */
export const MAX_PINS = 12;

/** Сколько проектов помним. Без ограничения запись росла бы бесконечно. */
const MAX_PROJECTS = 20;

export interface PinnedScene {
  id: number;
  /**
   * Имя нужно вкладке как подпись ДО того, как приедет `sceneList`. При отрисовке
   * предпочитаем свежее имя из списка схем, а это — запасное.
   */
  name: string;
}

/** Ключ вкладки «Рецепты» в перетаскиваемом ряду — она не схема, но место в ряду занимает. */
export const RECIPES_TAB_KEY = "recipes";

export interface PinnedTabs {
  pins: PinnedScene[];
  /**
   * Место «Рецептов» среди перетаскиваемых вкладок: индекс вставки в список
   * закреплённых схем. `pins.length` — в конце ряда (значение по умолчанию).
   */
  recipesIndex: number;
}

interface ProjectPins extends PinnedTabs {
  /** Метка времени: по ней вытесняются давно не открывавшиеся проекты. */
  t: number;
}

type PinStore = Record<string, ProjectPins>;

const keyOf = (projectId: number | string | null | undefined): string => String(projectId ?? "-");

/** Отбрасывает мусор: запись без числового id или без непустого имени вкладкой быть не может. */
const sanitize = (raw: unknown): PinnedScene[] => {
  if (!Array.isArray(raw)) return [];
  const out: PinnedScene[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const pin = item as Partial<PinnedScene> | null;
    if (!pin || typeof pin.id !== "number" || !Number.isFinite(pin.id)) continue;
    if (typeof pin.name !== "string" || !pin.name) continue;
    if (seen.has(pin.id)) continue;
    seen.add(pin.id);
    out.push({id: pin.id, name: pin.name});
    if (out.length >= MAX_PINS) break;
  }
  return out;
};

const readStore = (): PinStore => {
  try {
    const raw = localStorage.getItem(LS_PINS);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as PinStore) : {};
  } catch {
    // Битый JSON или недоступное хранилище (приватный режим) — начинаем с чистого листа.
    return {};
  }
};

/** Индекс в допустимых границах: набор закреплённых мог измениться с прошлой записи. */
const clampRecipesIndex = (raw: unknown, pinsLength: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return pinsLength;
  return Math.min(Math.max(0, Math.round(n)), pinsLength);
};

/** Закреплённые схемы проекта и место «Рецептов» — в порядке, заданном перетаскиванием. */
export function readPinnedTabs(projectId: number | string | null | undefined): PinnedTabs {
  if (projectId == null) return {pins: [], recipesIndex: 0};

  const entry = readStore()[keyOf(projectId)];
  const pins = sanitize(entry?.pins);
  return {pins, recipesIndex: clampRecipesIndex(entry?.recipesIndex, pins.length)};
}

/** Сохраняет порядок вкладок проекта. */
export function writePinnedTabs(
  projectId: number | string | null | undefined,
  {pins, recipesIndex}: PinnedTabs,
): void {
  if (projectId == null) return;

  const store = readStore();
  const safePins = sanitize(pins);
  store[keyOf(projectId)] = {
    pins: safePins,
    recipesIndex: clampRecipesIndex(recipesIndex, safePins.length),
    t: Date.now(),
  };

  const keys = Object.keys(store);
  if (keys.length > MAX_PROJECTS) {
    // Оставляем проекты, к которым обращались недавно.
    keys
      .sort((a, b) => (store[b]?.t ?? 0) - (store[a]?.t ?? 0))
      .slice(MAX_PROJECTS)
      .forEach(k => delete store[k]);
  }

  try {
    localStorage.setItem(LS_PINS, JSON.stringify(store));
  } catch {
    // Квота или приватный режим: закрепление не переживёт перезагрузку, но работать не мешает.
  }
}
