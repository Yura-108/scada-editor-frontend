import {PropertyCreateDto} from "@/types/tags.types";

export type SceneType = {
  id: number;
  name: string;
  type: string;
  parent_key: string | null;
  image: string | null;
  children: string[];
  version: number;
}


export type ComponentCreateDto = {
  key: string;
  name: string;
  children: ComponentCreateDto[];
  version: number;
  type: string;
  parent_key: string | null;
  parent_id: number | null;
  image: any;
};
// Базовый интерфейс для всех элементов на холсте (листья + группы)
export interface BaseCanvasElement {
  id: number | null;
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  composition: boolean;
  children: string[];
  parentId: number | null;
  parentKey: string | null;
  properties: PropertyCreateDto[];
  rotation?: number;
  label?: string;
  visible?: boolean;
  bg?: string;
}

export type ElementType =
  | "lamp"
  | "button"
  | "indicator"
  | "tank"
  | "valve"
  | "numeric"
  | "text"
  | "polygon"
  | "path"
  | "rectangle"
  | "circle"
  | "line"
  | "custom"
  //| "svg"         // если есть кастомные SVG
  //| "input";

// Простой элемент (листовой)
export interface LeafElement extends BaseCanvasElement {
  type: ElementType;
  color?: string;
  size?: number | "small" | "medium" | "large";
  status?: "open" | "closed" | "error" | "on" | "off" | "warning";
  value?: number | string;
  unit?: string;
  precision?: number;
  level?: number;
  fluidColor?: string;
  strokeColor?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  textColor?: string;
  scaleLines?: boolean;
  fontSize?: number;
  bold?: boolean;
  text?: string;
  rx?: number;                  // скругление углов (border-radius)
  ry?: number;

  // Для line
  x1?: number;
  y1?: number;
  x2?: number;                  // конечная точка X
  y2?: number;                  // конечная точка Y
  strokeWidth?: number;
  strokeDasharray?: string;     // "5 5" для пунктира и т.д.
  arrowStart?: boolean;
  arrowEnd?: boolean;
  background?: boolean;
  align?: string;

  rotate?: number;      // градусы
  scaleX?: number;      // 1 = норм
  scaleY?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;     // 0-1
  zIndex?: number;
  points?: string;
  unitColor?: string;
  fontFamily?: string;
  letterSpacing?: number;
  pressed? : boolean;
  d?: string; // SVG path data
  // ... добавляй по мере необходимости
}

// Группа / Faceplate / Container
export interface GroupElement extends BaseCanvasElement {
  type: "group" | "faceplate";
  collapsed?: boolean;
  borderStyle?: "solid" | "dashed" | "none";
  borderColor?: string;
  backgroundOpacity?: number;
}


// Общий тип для всех элементов на холсте
export type DiagramElement = LeafElement | GroupElement;


// Схема всего холста
export type CanvasSchema = {
  id: string;
  name: string;
  elements: DiagramElement[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PropertySchema =
  | {
  key: string;
  label: string;
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}
  | {
  key: string;
  label: string;
  type: "text";
  defaultValue?: string;
  placeholder?: string;
}
  | {
  key: string;
  label: string;
  type: "boolean";
  defaultValue?: boolean;
}
| {
  key: string;
  label: string;
  type: "color";
  defaultValue?: string;
}
| {
  key: string;
  label: string;
  type: "select";
  options: {label: string; value: string}[];
  defaultValue?: string;
}
