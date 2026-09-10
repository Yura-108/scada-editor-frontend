/**
 * Положение и свёрнутость HUD процедуры — в localStorage браузера.
 *
 * Это личная настройка рабочего места: где оператору удобно держать окно, чтобы оно не
 * закрывало нужный узел мнемосхемы. На сервер не едет и ничего не помечает изменённым.
 * Конвенции те же, что у `pinnedScenes.ts` и `sceneCamera.ts`: один ключ на всё,
 * `try/catch` на чтении и записи, проверка формы на чтении.
 */

const LS_KEY = "scada-editor:procedure-hud";

export interface HudPrefs {
  /** Отступы от левого верхнего угла области схемы, в пикселях. */
  x: number;
  y: number;
  collapsed: boolean;
}

/** По умолчанию — правый верхний угол: правый нижний занят элементами масштаба. */
export const DEFAULT_HUD_PREFS: HudPrefs = {x: -1, y: 16, collapsed: true};

/** `x === -1` означает «прижать к правому краю»: ширину окна на этапе чтения ещё не знаем. */
export const isRightAligned = (x: number): boolean => x < 0;

export function readHudPrefs(): HudPrefs {
  if (typeof window === "undefined") return DEFAULT_HUD_PREFS;

  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_HUD_PREFS;

    const parsed = JSON.parse(raw) as Partial<HudPrefs> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_HUD_PREFS;

    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : DEFAULT_HUD_PREFS.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : DEFAULT_HUD_PREFS.y,
      collapsed: typeof parsed.collapsed === "boolean"
        ? parsed.collapsed
        : DEFAULT_HUD_PREFS.collapsed,
    };
  } catch {
    // Испорченная или недоступная запись не должна ронять монитор.
    return DEFAULT_HUD_PREFS;
  }
}

export function writeHudPrefs(prefs: HudPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    // Квота или приватный режим — настройка не критична, молча пропускаем.
  }
}

/**
 * Загоняет точку обратно в видимую область.
 *
 * Нужно и при чтении, и после перетаскивания: окно могли уменьшить с прошлого раза, и
 * сохранённая точка увела бы HUD за край — оператор не смог бы ни нажать кнопки, ни
 * вернуть окно на место.
 */
export function clampHudPosition(
  x: number,
  y: number,
  hud: {width: number; height: number},
  area: {width: number; height: number},
  margin = 8,
): {x: number; y: number} {
  // Область может оказаться уже самого окна — тогда прижимаем к левому верхнему углу,
  // а не выдаём отрицательный предел.
  const maxX = Math.max(margin, area.width - hud.width - margin);
  const maxY = Math.max(margin, area.height - hud.height - margin);

  return {
    x: Math.min(Math.max(x, margin), maxX),
    y: Math.min(Math.max(y, margin), maxY),
  };
}
