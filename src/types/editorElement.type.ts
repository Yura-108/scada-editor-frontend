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

// Простой элемент (листовой)
export interface LeafElement extends BaseCanvasElement {
  type:
    | "lamp"
    | "button"
    | "indicator"
    | "tank"
    | "valve"
    | "numeric"
    | "text"
    | "rectangle"     // ← новый
    | "circle"        // ← новый
    | "line"          // ← новый
    | "svg"         // если есть кастомные SVG
    | "input";      // если есть

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

  // Для circle / ellipse
  rx?: number;                  // горизонтальный радиус (для ellipse)
  ry?: number;                  // вертикальный радиус

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

// Соединение (линия/провод)
export interface ConnectionElement {
  id: string;
  type: "connection";
  fromNode: string;             // id узла-источника
  fromPort: string;             // id порта-источника
  toNode: string;
  toPort: string;
  // можно добавить: color, thickness, label, waypoints и т.д.
}

// Общий тип для всех элементов на холсте
export type DiagramElement = LeafElement | GroupElement | ConnectionElement;

// Порты (оставляем почти без изменений)
export type PortPosition = "top" | "right" | "bottom" | "left";

export type Port = {
  id: string;
  position: PortPosition;
  // можно расширить позже: connectedTo?: string; type?: "input" | "output"; label?: string;
};

// Схема всего холста
export type CanvasSchema = {
  id: string;
  name: string;
  elements: DiagramElement[];
  version: number;
  createdAt: string;
  updatedAt: string;
};