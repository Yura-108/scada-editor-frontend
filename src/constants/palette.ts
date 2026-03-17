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
    id: 10 ** 5 + 2,
    type: "rectangle",
    name: "Rectangle",
    category: "Basic",
    defaultProps: {name: "Rectangle"}
  },
  {
    id: 10 ** 5 + 3,
    type: "polygon",
    name: "Polygon",
    category: "Basic",
    defaultProps: {name: "Polygon"}
  },
  {
    id: 10 ** 5 + 4,
    type: "path",
    name: "Path",
    category: "Basic",
    defaultProps: {name: "Path"}
  },
  {
    id: 10 ** 5 + 5,
    type: "button",
    name: "Button",
    category: "Basic",
    defaultProps: { name: "Button" },
  },
  {
    id: 10 ** 5 + 6,
    type: "text",
    name: "Text",
    category: "Basic",
    defaultProps: { text: "Text" },
  },

  // INDICATORS
  {
    id: 10 ** 5 + 7,
    type: "lamp",
    name: "Lamp",
    category: "Indicators",
    defaultProps: { value: false },
  },
  {
    id: 10 ** 5 + 8,
    type: "numeric",
    name: "Numeric Display",
    category: "Indicators",
    defaultProps: { value: 0 },
  },
  {
    id: 10 ** 5 + 9,
    type: "indicator",
    name: "Indicator",
    category: "Indicators",
    defaultProps: {value: 0}
  },

  // PROCESS
  {
    id: 10 ** 5 + 10,
    type: "valve",
    name: "Valve",
    category: "Process",
    defaultProps: {},
  },
  {
    id: 10 ** 5 + 11,
    type: "tank",
    name: "Tank",
    category: "Process",
    defaultProps: { level: 50 },
  },
];