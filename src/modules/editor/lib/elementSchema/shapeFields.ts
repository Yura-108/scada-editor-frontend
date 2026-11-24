import {ElementType, PropertySchema} from "@/core/scene";
import {DASH_FIELD} from "./commonFields";

/** Поля фигур: прямоугольник, круг, дуга, кривая, линия, многоугольник, путь. */
export const shapeFields = {
  rectangle: [
    {
      key: "text",
      label: "Надпись",
      type: "text",
      defaultValue: "",
    },
    {
      key: "fontSize",
      label: "Кегль надписи",
      type: "number",
      min: 6,
      max: 200,
      defaultValue: 14,
    },
    {
      key: "textColor",
      label: "Цвет надписи",
      type: "color",
      defaultValue: "#ffffff",
    },
    {
      key: "bg",
      label: "Цвет заливки",
      type: "color",
      defaultValue: "#4b5563",
    },
    {
      key: "strokeColor",
      label: "Цвет обводки",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина обводки",
      type: "number",
      min: 0,
      max: 20,
      defaultValue: 2,
    },
    DASH_FIELD,
    {
      key: "rx",
      label: "Скругление углов (X)",
      type: "number",
      min: 0,
      max: 100,
      defaultValue: 0,
    },
    {
      key: "ry",
      label: "Скругление углов (Y)",
      type: "number",
      min: 0,
      max: 100,
      defaultValue: 0,
    },
  ],
  circle: [
    {
      key: "text",
      label: "Надпись",
      type: "text",
      defaultValue: "",
    },
    {
      key: "fontSize",
      label: "Кегль надписи",
      type: "number",
      min: 6,
      max: 200,
      defaultValue: 14,
    },
    {
      key: "textColor",
      label: "Цвет надписи",
      type: "color",
      defaultValue: "#ffffff",
    },
    {
      key: "radius",
      label: "Радиус",
      type: "number",
      min: 1,
      max: 1000,
      defaultValue: 40,
    },
    {
      key: "bg",
      label: "Цвет заливки",
      type: "color",
      defaultValue: "#4b5563",
    },
    {
      key: "strokeColor",
      label: "Цвет обводки",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина обводки",
      type: "number",
      min: 0,
      max: 20,
      defaultValue: 2,
    },
  ],
  arc: [
    // Радиус, начало и раствор правятся в блоке «Геометрия» и ручками на холсте —
    // здесь только то, чего на холсте нет.
    {
      key: "innerRadius",
      label: "Внутренний радиус",
      type: "number",
      min: 0,
      max: 1000,
      defaultValue: 0,
    },
    {
      key: "arcClosed",
      label: "Замкнуть радиусами (сектор)",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "bg",
      label: "Цвет заливки",
      type: "color",
      defaultValue: "transparent",
    },
    {
      key: "strokeColor",
      label: "Цвет обводки",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина обводки",
      type: "number",
      min: 1,
      max: 20,
      defaultValue: 2,
    },
    DASH_FIELD,
  ],
  curve: [
    // Форма правится ручками на холсте: два конца и две направляющие точки.
    {
      key: "strokeColor",
      label: "Цвет линии",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина",
      type: "number",
      min: 1,
      max: 20,
      defaultValue: 2,
    },
    DASH_FIELD,
    {
      key: "arrowStart",
      label: "Стрелка в начале",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "arrowEnd",
      label: "Стрелка в конце",
      type: "boolean",
      defaultValue: false,
    },
  ],
  line: [
    {
      key: "strokeColor",
      label: "Цвет линии",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина",
      type: "number",
      min: 1,
      max: 20,
      defaultValue: 3,
    },
    DASH_FIELD,
    {
      key: "arrowEnd",
      label: "Стрелка в конце",
      type: "boolean",
      defaultValue: false,
    },
  ],
  polygon: [
    {
      key: "sides",
      label: "Количество углов",
      type: "number",
      min: 3,
      max: 100,
      defaultValue: 3,
    },
    {
      key: "bg",
      label: "Цвет заливки",
      type: "color",
      defaultValue: "#4b5563",
    },
    {
      key: "strokeColor",
      label: "Цвет обводки",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина",
      type: "number",
      min: 0,
      max: 20,
      defaultValue: 2,
    },
    DASH_FIELD,
  ],
  path: [
    {
      key: "d",
      label: "Контур (SVG path)",
      type: "text",
      defaultValue: "M10 50 Q50 10 90 50 T90 90",
    },
    {
      key: "bg",
      label: "Заливка",
      type: "color",
      defaultValue: "none",
    },
    {
      key: "strokeColor",
      label: "Цвет линии",
      type: "color",
      defaultValue: "#9ca3af",
    },
    {
      key: "strokeWidth",
      label: "Толщина",
      type: "number",
      min: 0,
      max: 20,
      defaultValue: 2,
    },
  ],
} satisfies Partial<Record<ElementType, PropertySchema[]>>;
