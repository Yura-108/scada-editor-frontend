import {DiagramElement, ElementType} from "@/types/editorElement.type";
import {createUuid} from "@/shared/lib/createUuid";
import {DEFAULT_CURVE_POINTS, curvePointsBounds} from "@/core/scene";

/**
 * Заготовки новых элементов для `addElementAt`: что лежит в элементе, только что
 * поставленном из палитры. Элемент строится в МИРОВЫХ координатах и в корне сцены —
 * в открытый контейнер его переносит `placeNewElement`.
 *
 * Общие поля у всех типов одни (`baseElement`), свои — в `TYPE_PROPS`. Набор полей у
 * каждого типа ровно тот, что был у отдельной ветки `addElementAt`: где не было `label`
 * или `bg`, их нет и сейчас.
 */

type Extra = Record<string, unknown> | undefined;

/** Поля, общие для всех типов: идентичность, место в иерархии, пустые списки, состояние. */
function baseElement(type: ElementType, x: number, y: number, sceneId: number | undefined, key: string) {
  return {
    id: null,
    key,
    type,
    composition: [] as string[],
    x,
    y,
    parentId: sceneId || null,
    parentKey: String(sceneId) || null,
    children: [] as string[],
    scripts: [],
    bindings: [],
    properties: [],
    states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
  };
}

/** Свои поля типа: размер, оформление, значение. */
const TYPE_PROPS: Partial<Record<string, (x: number, y: number, extra: Extra) => Record<string, unknown>>> = {
  line: (x, y) => ({
    x1: x - 40,
    x2: x + 40,
    y1: y,
    y2: y,
    w: 80,
    h: 80,
    label: "Element",
    bg: "transparent",
  }),

  curve: () => {
    // Кубическая кривая Безье: точки локальны относительно x/y (как у полигона),
    // поэтому перетаскивание меняет только x/y, а форма живёт в points.
    const points = [...DEFAULT_CURVE_POINTS];
    const bounds = curvePointsBounds(points);
    return {
      w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY,
      points,
      label: "",
      bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2, strokeDasharray: "",
      arrowStart: false, arrowEnd: false,
    };
  },

  arc: () => {
    // Радиус 60 = три клетки; габарит — описанный квадрат 2r×2r, как у круга
    // (см. ArcShapeElement). Раствор 90°, начало 0° — четверть окружности
    // от «трёх часов» по часовой стрелке.
    const radius = 60;
    return {
      w: 2 * radius, h: 2 * radius,
      radius, innerRadius: 0, angle: 90, rotate: 0, arcClosed: false,
      label: "",
      bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2, strokeDasharray: "",
    };
  },

  checkbox: () => ({
    w: 160, h: 20,
    checked: false, label: "Checkbox",
    color: "#3b82f6", strokeColor: "#3b82f6",
    bg: "transparent",
  }),

  progress_bar: () => ({
    w: 200, h: 20,
    value: 50, label: "", orientation: "horizontal",
    color: "#3b82f6", backgroundColor: "#e5e7eb",
    textColor: "#ffffff", showPercentage: true,
  }),

  button: () => ({
    w: 120, h: 40,
    // label — название элемента, text — надпись на кнопке: поля независимы.
    label: "Кнопка", text: "Кнопка", color: "#3b82f6", textColor: "#ffffff", fontSize: 16,
    rx: 6, pressed: false, enabled: true, bg: "transparent",
  }),

  toggle: () => ({
    w: 40, h: 20,
    checked: false, label: "",
    color: "#22c55e", backgroundColor: "#9ca3af", textColor: "#e5e7eb", bg: "transparent",
  }),

  slider: () => ({
    w: 160, h: 20,
    value: 50, min: 0, max: 100,
    color: "#3b82f6", backgroundColor: "#d1d5db", bg: "transparent",
  }),

  dropdown: () => ({
    w: 160, h: 40,
    value: "Выбор",
    backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a", bg: "transparent",
  }),

  input: () => ({
    w: 160, h: 40,
    value: "", placeholder: "Введите...",
    backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a", bg: "transparent",
  }),

  image: (_x, _y, extra) => ({
    w: typeof extra?.w === 'number' ? extra.w : 120,
    h: typeof extra?.h === 'number' ? extra.h : 120,
    src: typeof extra?.src === 'string' ? extra.src : "",
    objectFit: "contain", bg: "transparent",
    label: "Картинка",
  }),

  table: () => ({
    w: 300, h: 160,
    rows: 4, cols: 3, showHeader: true, headerText: "Таблица", alternateRow: false,
    backgroundColor: "transparent", headerColor: "transparent",
    strokeColor: "#000000", textColor: "#000000", fontSize: 12,
    alternateColor: "#f1f5f9",
    cells: {},
  }),
};

/** Все прочие типы: квадрат 80×80. */
const defaultProps = (type: ElementType) => ({
  w: 80,
  h: 80,
  // У круга рендер и панель свойств читают radius, а не w/h. Без него фигура
  // рисовалась по w/2, но в панели «Радиус» стоял 0, а первая же правка радиуса
  // прыгала с 40 на введённое. Держим тройку radius/w/h согласованной с рождения.
  ...(type === "circle" ? {radius: 40} : {}),
  label: "Element",
  bg: "transparent",
});

/**
 * Новый элемент типа `type` в точке `x, y` (уже на сетке) в корне сцены `sceneId`.
 *
 * Картинка: дроп создаёт элемент СРАЗУ (плейсхолдер), src заполняется обработчиком
 * после выбора файла в проводнике — по этому же key (`extraProps.key`).
 */
export function buildNewElement(
  type: ElementType,
  x: number,
  y: number,
  sceneId: number | undefined,
  extraProps?: Record<string, unknown>,
): DiagramElement {
  const key = type === 'image' && typeof extraProps?.key === 'string' ? extraProps.key : createUuid();
  const base = baseElement(type, x, y, sceneId, key);
  const own = TYPE_PROPS[type]?.(x, y, extraProps) ?? defaultProps(type);
  return {...base, ...own} as DiagramElement;
}
