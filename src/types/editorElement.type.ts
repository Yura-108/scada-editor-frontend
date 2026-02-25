// types/editorElement.type.ts

// Базовый интерфейс для всех элементов на холсте (листья + группы)
export interface BaseCanvasElement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId?: string;
  rotation?: number;          // если планируешь поворот групп
  label?: string;
  visible?: boolean;
  bg?: string;
  ports?: Port[];
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
  | "rectangle"     // ← новый
  | "circle"        // ← новый
  | "line"          // ← новый
  | "svg"         // если есть кастомные SVG
  | "input";

// Простой элемент (листовой)
export interface LeafElement extends BaseCanvasElement {
  type: ElementType;

  // Общие свойства (можно вынести в mixin, если много дублирования)
  color?: string;
  size?: number | "small" | "medium" | "large";

  // Специфичные свойства (по типу)
  status?: "open" | "closed" | "error" | "on" | "off" | "warning";
  value?: number | string;
  unit?: string;
  precision?: number;
  level?: number;                // tank
  fluidColor?: string;
  strokeColor?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  textColor?: string;
  scaleLines?: boolean;
  fontSize?: number;
  bold?: boolean;
  text?: string;
  // Для rectangle
  rx?: number;                  // скругление углов (border-radius)
  ry?: number;

  // Для line
  x2?: number;                  // конечная точка X
  y2?: number;                  // конечная точка Y
  strokeWidth?: number;
  strokeDasharray?: string;     // "5 5" для пунктира и т.д.
  arrowStart?: boolean;
  arrowEnd?: boolean;

  rotate?: number;      // градусы
  scaleX?: number;      // 1 = норм
  scaleY?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;     // 0-1
  zIndex?: number;
  points?: string;
  d?: string; // SVG path data
  // ... добавляй по мере необходимости
}

// Группа / Faceplate / Container
export interface GroupElement extends BaseCanvasElement {
  type: "group" | "faceplate";
  children: string[];           // массив ID дочерних элементов (плоский список)
  // children?: (LeafElement | GroupElement)[];   ← вложенные объекты (альтернатива, но тяжелее для zustand/undo)

  // Дополнительные свойства группы
  collapsed?: boolean;          // свёрнута ли группа визуально
  borderStyle?: "solid" | "dashed" | "none";
  borderColor?: string;
  backgroundOpacity?: number;   // прозрачность фона группы
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