import type { DiagramElement } from "@/types/editorElement.type";

/** Минимальный размер элемента при ресайзе (совпадает с шагом сетки). */
export const MIN_SIZE = 20;

export interface ThemeColors {
  textDefault: string;
  labelDefault: string;
  strokeDefault: string;
  canvasBg: string;
  /** «Стол» вокруг листа сцены. */
  deskBg: string;
  /** Кромка листа. */
  sheetBorder: string;
  gridLine: string;
  /** Линия крупного шага сетки (10 клеток). */
  gridLineMajor: string;
  anchorFill: string;
  anchorStroke: string;
  /** Единый цвет выделения: обводка фигуры, рамка Transformer, подсветка наведения. */
  selection: string;
  /** Заливка рамки-протяжки (тот же оттенок, что и `selection`). */
  selectionFill: string;
  /** Заливка ручек Transformer. */
  handleFill: string;
  /** Обводка активной (входящей) группы. */
  activeGroup: string;
  /** Направляющие привязки к соседям (smart guides). */
  guide: string;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** "danger" — деструктивное действие (красная подпись). */
  variant?: "danger";
}

/** Пропы для простых листовых Konva-компонентов (text/checkbox/progress_bar). */
export interface ShapeElementProps {
  el: DiagramElement;
  isSelected: boolean;
  /**
   * Активное состояние элемента и рантайм-оверрайды монитора.
   *
   * Приходят пропами, а не читаются из стора: состояние живёт отдельной картой
   * (`currentComponentStateByElementKey`), при его смене сам элемент не меняется —
   * и любая мемоизация по пропам вернула бы прошлый рендер. Считать вид фигуры
   * нужно через `getRenderedElementWith(el, stateId, runtime)`; нереактивный
   * `getRenderedElement(el)` здесь — скрытая мина на будущее.
   */
  stateId: string | undefined;
  runtime: Record<string, unknown> | undefined;
  snap: (v: number) => number;
  onElementClick: (key: string, multi: boolean) => void;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  /** true, если этот текстовый элемент сейчас редактируется инлайн (Konva-текст прячется под textarea). */
  isEditing?: boolean;
  /** Запускает инлайн-редактирование текста (двойной клик). */
  onStartTextEdit?: (key: string) => void;
}

/** Ячейка таблицы, сфокусированная в панели свойств (см. store.selectedTableCell). */
export interface SelectedTableCell {
  elementKey: string;
  row: number;
  col: number;
}

/**
 * Общий контекст рендеринга, прокидываемый в узлы холста вместо длинного списка
 * пропов. Собирается один раз в Canvas и **обязан быть стабильным по ссылке**.
 *
 * Раньше сюда входили `selectedIds`, `elementsMap`, карты состояний и ячейка
 * таблицы — то есть контекст менялся при любой правке схемы и любом клике, и
 * React.memo на узлах не срабатывал никогда: перерисовывалась вся сцена.
 * Теперь всё изменчивое каждый узел читает про себя сам, точечным селектором
 * (см. useElementRenderState), а здесь остаются только колбэки и палитра.
 *
 * Колбэки обязаны быть стабильными: те, что зависят от выделения или состава
 * схемы, читают их через `useEditorStore.getState()` в момент вызова, а не
 * через замыкание.
 */
export interface EditorRenderContext {
  themeColors: ThemeColors;
  snap: (v: number) => number;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  onElementClick: (key: string, multi: boolean) => void;
  enterGroup: (key: string) => void;
  resolveClickTarget: (key: string) => string | null;
  closeMenu: () => void;
  /** Запускает инлайн-редактирование текста по двойному клику. */
  onStartTextEdit: (key: string) => void;
  /** Клик по конкретной ячейке таблицы: выделяет саму таблицу и фокусирует ячейку. */
  onTableCellClick: (elementKey: string, row: number, col: number, multi: boolean) => void;
}
