import { PaletteItemType } from "@/types/palette.types";

export const paletteItems: PaletteItemType[] = [
  // BASIC
  {
    id: 0,
    type: "line",
    label: "Line",
    category: "Basic",
    defaultProps: {label: "Line"}
  },
  {
    id: 1,
    type: "circle",
    label: "Circle",
    category: "Basic",
    defaultProps: {label: "Circle"}
  },
  {
    id: 2,
    type: "rectangle",
    label: "Rectangle",
    category: "Basic",
    defaultProps: {label: "Rectangle"}
  },
  {
    id: 3,
    type: "polygon",
    label: "Polygon",
    category: "Basic",
    defaultProps: {label: "Polygon"}
  },
  {
    id: 4,
    type: "path",
    label: "Path",
    category: "Basic",
    defaultProps: {label: "Path"}
  },
  {
    id: 5,
    type: "button",
    label: "Button",
    category: "Basic",
    defaultProps: { label: "Button" },
  },
  {
    id: 6,
    type: "text",
    label: "Text",
    category: "Basic",
    defaultProps: { text: "Text" },
  },

  // INDICATORS
  {
    id: 7,
    type: "lamp",
    label: "Lamp",
    category: "Indicators",
    defaultProps: { value: false },
  },
  {
    id: 8,
    type: "numeric",
    label: "Numeric Display",
    category: "Indicators",
    defaultProps: { value: 0 },
  },
  {
    id: 9,
    type: "indicator",
    label: "Indicator",
    category: "Indicators",
    defaultProps: {value: 0}
  },

  // PROCESS
  {
    id: 10,
    type: "valve",
    label: "Valve",
    category: "Process",
    defaultProps: {},
  },
  {
    id: 11,
    type: "tank",
    label: "Tank",
    category: "Process",
    defaultProps: { level: 50 },
  },

  // SHAPES
  // {
  //   type: "line",
  //   label: "Line",
  //   category: "Shapes",
  //   defaultProps: {},
  // },
];