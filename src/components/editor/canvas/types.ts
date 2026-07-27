import type { DiagramElement } from "@/types/editorElement.type";

/** Минимальный размер элемента при ресайзе (совпадает с шагом сетки). */
export const MIN_SIZE = 20;

export interface ThemeColors {
  textDefault: string;
  labelDefault: string;
  strokeDefault: string;
  canvasBg: string;
  gridLine: string;
  anchorFill: string;
  anchorStroke: string;
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
}

/** Пропы для простых листовых Konva-компонентов (text/checkbox/progress_bar). */
export interface ShapeElementProps {
  el: DiagramElement;
  isSelected: boolean;
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
 * Общий контекст рендеринга, прокидываемый в ShapeElement/GroupNode вместо
 * длинного списка пропов. Собирается один раз в Canvas.
 */
export interface EditorRenderContext {
  selectedIds: string[];
  activeGroupKey: string | null;
  elementsMap: Record<string, DiagramElement>;
  themeColors: ThemeColors;
  snap: (v: number) => number;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
  onElementClick: (key: string, multi: boolean) => void;
  enterGroup: (key: string) => void;
  resolveClickTarget: (key: string) => string | null;
  closeMenu: () => void;
  /** Ключ текстового элемента, редактируемого сейчас инлайн (или null). */
  editingTextKey: string | null;
  /** Запускает инлайн-редактирование текста по двойному клику. */
  onStartTextEdit: (key: string) => void;
  /**
   * Активное состояние по ключу элемента. Фигуры читают состояние через
   * getRenderedElement (getState()), но это поле ОБЯЗАНО быть в контексте:
   * оно меняет identity ctx при переключении состояния и «пробивает» React.memo
   * фигур — иначе смена состояния не перерисуется.
   */
  currentComponentStateByElementKey: Record<string, string>;
  /**
   * Рантайм-оверрайды монитора. Как и currentComponentStateByElementKey,
   * фигуры читают их через getRenderedElement (getState()), но поле обязано
   * быть в контексте — тик рантайма меняет identity ctx и «пробивает» React.memo.
   */
  runtimeOverridesByElementKey: Record<string, Record<string, unknown>>;
  /**
   * Ключ элемента, к которому прицеплен SelectionTransformer (или null).
   * Такая фигура НЕ рисует собственную пунктирную рамку выделения —
   * иначе двойная рамка (своя + трансформера) выглядит грязно.
   */
  transformerKey: string | null;
  /** Ячейка таблицы, сфокусированная для панели свойств (см. store.selectedTableCell). */
  selectedTableCell: SelectedTableCell | null;
  /** Клик по конкретной ячейке таблицы: выделяет саму таблицу (как сегодня) и фокусирует ячейку. */
  onTableCellClick: (elementKey: string, row: number, col: number, multi: boolean) => void;
}
