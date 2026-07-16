import {PropertyCreateDto} from "@/types/tags.types";
import {TagBinding} from "@/types/binding.types";

export type SceneType = {
  id: number;
  name: string;
  type: string;
  parent_key: string | null;
  image: string | null;
  children: string[];
  version: number;
  project_id?: number;
}

// export type Overrides = {
//   x?: number;
//   y?: number;
//   w?: number;
//   h?: number;
//   bg?: string;
//   rotation?: number;
//   visible?: boolean;
//   strokeColor?: string;
//   strokeWidth?: string;
//   opacity?: number;
// }

export type ComponentState = {
  id: string;
  name: string;
  overrides: Record<string, unknown>;
  isDefault?: boolean;
}

export interface ElementScript {
  id: string;
  name: string;
  content: string;
}

export type ComponentCreateDto = {
  key: string;
  id: number | null;
  name: string;
  children: ComponentCreateDto[];
  version: number;
  type: string;
  parent_key: string | null;
  parent_id: number | null;
  scripts: { name: string; script: string }[];
  bindings: { component_property_id: number; name: string; script: string }[];
  states: {
    name: string;
    image: string;
    isDefault: boolean;
  }[];
};
// Базовый интерфейс для всех элементов на холсте (листья + группы)
export interface BaseCanvasElement {
  id: number | null;
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ключи примитивов-членов (рисунок компонента, z-order). Пусто у обычных элементов и «глупых» групп. */
  composition: string[];
  /** true, если группа промоутнута в логический компонент («Создать компонент»). */
  isComponent?: boolean;
  children: string[];
  parentId: number | null;
  parentKey: string | null;
  scripts: ElementScript[];
  bindings: TagBinding[];
  properties: PropertyCreateDto[];
  states: ComponentState[];


  rotation?: number;
  label?: string;
  visible?: boolean;
  bg?: string;
}

export type ElementType =
  | "polygon"
  | "circle"
  | "line"
  | "text"
  | "group"
  | "custom"
  | "rectangle"
  | "path"
  | "progress_bar"
  | "checkbox"
  | "button"
  | "toggle"
  | "slider"
  | "dropdown"
  | "input"

// Простой элемент (листовой)
export interface LeafElement extends BaseCanvasElement {
  type: ElementType;
  color?: string;
  points?: number[]; // Array of [x1,y1, x2,y2, ...] relative to element x,y or absolute? Let's use absolute or relative depending on implementation
  sides?: number; // for polygon initial generation
  radius?: number; // for circle and regular polygon initial generation
  size?: number | "small" | "medium" | "large";
  status?: "open" | "closed" | "error" | "on" | "off" | "warning";
  value?: number | string;
  unit?: string;
  precision?: number;
  min?: number;                 // slider: минимум шкалы
  max?: number;                 // slider: максимум шкалы
  placeholder?: string;         // input: текст-подсказка
  enabled?: boolean;            // button: активна ли кнопка
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
  /** Текст: true/undefined — ширина по содержимому (перенос только по Enter);
   *  false — фиксированная ширина `w` с переносом по словам (после растягивания). */
  autoWidth?: boolean;
  rx?: number;                  // скругление углов (border-radius)
  ry?: number;
  orientation?: "horizontal" | "vertical";  // для progress_bar

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

  fontFamily?: string;
  letterSpacing?: number;
  pressed? : boolean;
  checked?: boolean;
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
