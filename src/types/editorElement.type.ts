import {PropertyCreateDto} from "@/types/tags.types";
import {BindingDto, ElementEvents, TagBinding} from "@/types/binding.types";

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
  /** Локальный ключ состояния (uuid). Используется React и currentComponentStateByElementKey. */
  id: string;
  /**
   * Идентификатор состояния НА СЕРВЕРЕ — есть только у состояний, пришедших из бэкенда.
   *
   * Отдельное поле, а не `id`, потому что локальный `id` генерируется нами для новых
   * состояний, и отправить такой uuid на сервер нельзя. Обязательство контракта версий
   * (§2 «Что сливается, а что нет»): сущность, пришедшая с `id`, обязана вернуться с тем
   * же `id` — иначе переименование читается как «удалили и создали заново», история
   * теряется, а слияние выдаёт ложный конфликт на ровном месте.
   */
  serverId?: number | string;
  name: string;
  overrides: Record<string, unknown>;
  isDefault?: boolean;
}

export interface ElementScript {
  /**
   * Локальный ключ скрипта. У скриптов, пришедших с сервера, здесь лежит серверный id
   * строкой — на это опирается монитор (`Number(script.id)` в useRuntimeEngine), поэтому
   * поле не переименовываем.
   */
  id: string;
  /**
   * Серверный id — только у скриптов, пришедших из бэкенда. То же обязательство, что у
   * `ComponentState.serverId`: пришло с `id` — вернуть с тем же. Отдельно от `id`, потому
   * что у новых скриптов там uuid, отправлять который нельзя.
   */
  serverId?: number | string;
  name: string;
  content: string;
}

/**
 * Статические (design-time) данные одной ячейки таблицы. Ключ в LeafElement.cells —
 * `${row}_${col}` (0-based). Живое значение из привязки к тегу переопределяет `value`
 * через runtimeOverridesByElementKey[el.key][`cell_${row}_${col}`] — см. src/lib/editor/tableCells.ts.
 */
export interface TableCellData {
  value?: string;
  backgroundColor?: string;
  textColor?: string;
  align?: "left" | "center" | "right";
}

/**
 * Свойство-строка таблицы (привязка к тегу или локальный параметр) — отдельный,
 * более лёгкий контракт, чем PropertyCreateDto (у той требуются id/component_id,
 * которых ещё нет на этапе черновика в модалке привязки). Хранится прямо в
 * element.properties (никакого отдельного поля rowBindings). Номер строки — в
 * поле position самого PropertyCreateDto (см. src/lib/editor/rowBinding.ts),
 * а не закодирован в property_type: тот теперь обычная классификация
 * ("Тег" | "Локальный"), как у всех остальных свойств. tag_id === null — строка
 * без тега (локальный параметр, значение живёт в сессии, а не в ПЛК).
 */
export interface ComponentPropertyDto {
  name: string;
  tag_id: string | null;
  property_type: string;
  value_type: string;
  /** Значение по умолчанию для локальной строки (до первого изменения по WS). */
  default_value?: string;
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
  /** `id` — только у скриптов, пришедших с сервера (см. ElementScript.serverId). */
  scripts: { id?: number | string; name: string; script: string }[];
  bindings: BindingDto[];
  /** `id` — только у событий, пришедших с сервера. */
  events: { id?: number | string; event_type: string; script: string }[];
  states: {
    /** Возвращается только для состояний, пришедших с сервера (см. ComponentState.serverId). */
    id?: number | string;
    name: string;
    image: string;
    isDefault: boolean;
  }[];
  /** Только для type==="table": привязки строк к тегам/локальным параметрам,
   *  номер строки — в поле position (см. src/lib/editor/rowBinding.ts). */
  properties?: ComponentPropertyDto[];
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
  /** Обработчики событий (onClick/onDoubleClick) — JS, исполняются в мониторе. */
  events?: ElementEvents;


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
  | "gauge"
  | "table"
  | "trend"
  | "chart"
  | "image"

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

  // Для table
  rows?: number;
  cols?: number;
  showHeader?: boolean;
  headerText?: string;
  alternateRow?: boolean;
  alternateColor?: string;
  headerColor?: string;
  /** Статические данные ячеек по ключу "${row}_${col}". */
  cells?: Record<string, TableCellData>;
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
