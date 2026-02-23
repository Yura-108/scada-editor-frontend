export type PortPosition = "top" | "right" | "bottom" | "left";

export type Port = {
  id: string;
  position: PortPosition;
};

export type BaseElementType = "lamp" | "button" | "indicator" | "svg" | "input" | "tank" | "text";

export interface BaseElement {
  id: string;
  type: BaseElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  bg?: string;
  ports?: { id: string; position: "top" | "bottom" | "left" | "right" }[];
};

export type ConnectionElement = {
  id: string;
  type: "connection";
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
};

export type ElementType = BaseElement | ConnectionElement;

export type CanvasSchema = {
  id: string;
  name: string;
  elements: ElementType[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export interface ValveElement extends BaseElement {
  type: "valve";
  status: "open" | "closed" | "error";
}

export interface NumericDisplayElement extends BaseElement {
  type: "numeric";
  value: number;
  unit?: string;
  precision?: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
  bold?: boolean;
}
// types/editorElement.type.ts  (или где у тебя тип)

export type DiagramElement = {
  id: string;
  type:
    | "valve"
    | "numeric"
    | "text"
    | "button"
    | "indicator"
    | "lamp"
    | "tank"           // ← добавили
    | string;          // для будущих расширений

  x: number;
  y: number;
  w: number;
  h: number;

  // Общие / часто используемые
  label?: string;
  color?: string;
  size?: number | "small" | "medium" | "large";
  visible?: boolean;

  // Специфичные для tank
  level?: number;                // 0–100
  fluidColor?: string;
  strokeColor?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  textColor?: string;
  scaleLines?: boolean;

  // Для других элементов (оставляем как было)
  status?: string;
  value?: number;
  unit?: string;
  precision?: number;
  fontSize?: number;
  bold?: boolean;
  // ... и т.д.
};

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "color"
  | "boolean";

export interface PropertySchema {
  key: string;
  label: string;
  type: PropertyType;
  options?: { label: string; value: string }[];
}



