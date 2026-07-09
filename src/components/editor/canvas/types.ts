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
}
