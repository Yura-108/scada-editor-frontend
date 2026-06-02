import { PaletteItemType } from "@/types/palette.types";

export const paletteItems: PaletteItemType[] = [
  // BASIC
  {
    id: 10 ** 5,
    type: "line",
    name: "Линия",
    category: "Базовые",
    defaultProps: {name: "Line"}
  },
  {
    id: 10 ** 5 + 1,
    type: "circle",
    name: "Круг",
    category: "Базовые",
    defaultProps: {name: "Circle"}
  },
  {
    id: 10 ** 5 + 3,
    type: "polygon",
    name: "Многоугольник",
    category: "Базовые",
    defaultProps: {name: "Polygon"}
  },
  {
    id: 10 ** 5 + 4,
    type: "text",
    name: "Текст",
    category: "Базовые",
    defaultProps: {name: "Text", text: "Text", fontSize: 16, color: "#ffffff", bold: false, align: "left"}
  },

  // INDICATORS
  {
    id: 10 ** 5 + 7,
    type: "progress_bar",
    name: "Progress Bar",
    category: "Indicators",
    defaultProps: {value: 50, label: "Progress"},
  },
  {
    id: 10 ** 5 + 8,
    type: "checkbox",
    name: "Checkbox",
    category: "Indicators",
    defaultProps: {checked: false, label: "Checkbox"},
  },
];