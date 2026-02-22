export type PortPosition = "top" | "right" | "bottom" | "left";

export type Port = {
  id: string;
  position: PortPosition;
};

export type BaseElementType = "lamp" | "button" | "indicator" | "svg" | "input" | "tank";

export type BaseElement = {
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