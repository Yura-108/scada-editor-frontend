import {ElementType} from "@/types/editorElement.type";
import {ROTATABLE_TYPES} from "@/constants/propertiesPanel";
import {MIN_SIZE} from "@/components/editor/canvas/types";
import {getNumberValue} from "./getNumberValue";

export interface GeometryField {
  key: string;
  label: string;
  value?: number;
  commit?: (v: number) => Record<string, unknown>;
}

/**
 * Поля блока «Геометрия» — ровно те, что рендерер действительно читает.
 *
 * Раньше панель расходилась с холстом в двух местах: «Поворот°» показывался
 * для всех типов кроме группы, хотя `rotation` прокидывает только часть фигур
 * (см. ROTATABLE_TYPES); а у круга правились «Ширина»/«Высота», тогда как
 * рендерер берёт `radius || w / 2` — то есть ввод ширины ничего не менял.
 *
 * `values` — отображаемый вид элемента (`getRenderedElement`).
 */
export function getGeometryFields(type: string, values: Record<string, unknown>): GeometryField[] {
  if (type === "line") {
    return [
      {key: "x1", label: "X1"}, {key: "y1", label: "Y1"},
      {key: "x2", label: "X2"}, {key: "y2", label: "Y2"},
    ];
  }
  // Форму кривой задают четыре точки — их правят ручками на холсте, числами это
  // было бы восемь полей. В панели остаётся положение; w/h пересчитываются сами.
  if (type === "curve") return [{key: "x", label: "X"}, {key: "y", label: "Y"}];
  if (type === "text") {
    // У текста габарит вычисляемый: `h` не пишется вообще ничем и остаётся
    // ископаемым значением из `addElementAt`, а `w` действует только в режиме
    // фиксированной ширины (`autoWidth === false`). Показывать оба поля значило бы
    // предлагать править числа, которых рендерер не читает. В авторежиме ширину
    // задаёт ручка на холсте, вернуть его — двойной клик по ней.
    return [
      {key: "x", label: "X"}, {key: "y", label: "Y"},
      ...(values.autoWidth === false
        ? [{
            key: "w",
            label: "Ширина",
            commit: (v: number) => ({w: Math.max(MIN_SIZE, v), autoWidth: false}),
          }]
        : []),
    ];
  }
  if (type === "circle" || type === "arc") return circleFields(type === "arc", values);
  return [
    {key: "x", label: "X"}, {key: "y", label: "Y"},
    {key: "w", label: "Ширина"}, {key: "h", label: "Высота"},
    ...(ROTATABLE_TYPES.has(type as ElementType)
      ? [{key: "rotate", label: "Поворот°"}]
      : []),
  ];
}

/**
 * Круг и дуга описываются ЦЕНТРОМ и радиусом — так их двигает холст (центр
 * садится в узел сетки), так их задают ручки и так приходит выгрузка CONTUR.
 * В модели же в `x, y` лежит левый верхний угол габарита, поэтому панель
 * переводит одно в другое, а не показывает угол: иначе поля и жест на холсте
 * описывали бы разные точки.
 */
function circleFields(isArc: boolean, values: Record<string, unknown>): GeometryField[] {
  // Тот же порядок запасных значений, что у рендера (`radius || w / 2 || …`):
  // панель обязана описывать ровно то, что нарисовано.
  const r =
    getNumberValue(values.radius, getNumberValue(values.w) / 2)
    || (isArc ? 60 : 40);
  const cx = getNumberValue(values.x) + r;
  const cy = getNumberValue(values.y) + r;
  return [
    {key: "cx", label: "X центра", value: cx, commit: (v: number) => ({x: v - r})},
    {key: "cy", label: "Y центра", value: cy, commit: (v: number) => ({y: v - r})},
    {
      key: "radius",
      label: "Радиус",
      // Растём вокруг центра — как ручка на холсте. `w/h` держим равными
      // диаметру: рендер берёт radius, а выделение и рамка группы — w/h.
      commit: (v: number) => {
        const nr = Math.max(1, v);
        return {radius: nr, w: nr * 2, h: nr * 2, x: cx - nr, y: cy - nr};
      },
    },
    // Дуга: начало живёт в общем `rotate` (своего поворота у неё нет —
    // поворот дуги это и есть её начальный угол), раствор — в `angle`.
    ...(isArc
      ? [
          {
            key: "rotate",
            label: "Начало, °",
            commit: (v: number) => ({rotate: ((v % 360) + 360) % 360}),
          },
          {
            key: "angle",
            label: "Раствор, °",
            commit: (v: number) => ({angle: Math.min(360, Math.max(1, Math.round(v)))}),
          },
        ]
      : []),
  ];
}
