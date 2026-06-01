import { PaletteItemType } from "@/types/palette.types";

export const paletteItems: PaletteItemType[] = [
  // BASIC
  {
    id: 10 ** 5,
    type: "line",
    name: "Line",
    category: "Basic",
    defaultProps: {name: "Line"}
  },
  {
    id: 10 ** 5 + 1,
    type: "circle",
    name: "Circle",
    category: "Basic",
    defaultProps: {name: "Circle"}
  },
  {
    id: 10 ** 5 + 3,
    type: "polygon",
    name: "Polygon",
    category: "Basic",
    defaultProps: {name: "Polygon"}
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