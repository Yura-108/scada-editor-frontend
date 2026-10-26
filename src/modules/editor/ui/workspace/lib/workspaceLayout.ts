// Готовы только «Редактор» и «Рецепты». Раньше здесь были ещё 8 вкладок-заглушек
// (по 7 строк каждая) — они импортировались и разводились в switch, но ни одна
// не была достижима: полоса вкладок с ними закомментирована. Заглушки удалены,
// вернуть их можно вместе с реальным содержимым.
export type TabType = "editor" | "recipes";
export type LeftTabType = "palette" | "layers";
export type PanelSide = "left" | "right";

// Порядок вкладок для навигации стрелками.
export const MAIN_TABS = ["editor", "recipes"] as const satisfies readonly TabType[];
export const LEFT_TABS = ["palette", "layers"] as const satisfies readonly LeftTabType[];

// Ширины боковых панелей: дефолт/максимум/порог, ниже которого перетаскивание края схлопывает панель.
export const LEFT_DEFAULT = 288, LEFT_MAX = 480, LEFT_COLLAPSE = 160;
export const RIGHT_DEFAULT = 320, RIGHT_MAX = 520, RIGHT_COLLAPSE = 180;

/** Пределы ширины стороны: порог сворачивания, максимум, ширина по умолчанию. */
export const panelLimits = (side: PanelSide) => side === "left"
  ? {collapseAt: LEFT_COLLAPSE, max: LEFT_MAX, defaultWidth: LEFT_DEFAULT}
  : {collapseAt: RIGHT_COLLAPSE, max: RIGHT_MAX, defaultWidth: RIGHT_DEFAULT};

/**
 * Раскладка редактора в localStorage.
 *
 * Раньше здесь было два ключа только под ширины, и каждый эффект писал в
 * хранилище на КАЖДЫЙ пиксель перетаскивания края панели (сотни синхронных
 * записей на один жест). Теперь одна запись на всю раскладку, отложенная на
 * SAVE_DELAY после последнего изменения, и в неё попали свёрнутость панелей и
 * активные вкладки — их состояние терялось при перезагрузке.
 */
export const LS_LAYOUT = "scada-editor:layout";
export const SAVE_DELAY = 300;

export type PersistedLayout = {
  leftWidth: number;
  rightWidth: number;
  leftVisible: boolean;
  rightVisible: boolean;
  leftTab: LeftTabType;
  activeTab: TabType;
};

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const readLayout = (): Partial<PersistedLayout> => {
  try {
    const raw = localStorage.getItem(LS_LAYOUT);
    return raw ? (JSON.parse(raw) as Partial<PersistedLayout>) : {};
  } catch {
    return {};
  }
};

export const writeLayout = (layout: PersistedLayout): void => {
  try {
    localStorage.setItem(LS_LAYOUT, JSON.stringify(layout));
  } catch {
    // Квота/приватный режим — раскладка не сохранится, работать это не мешает.
  }
};
