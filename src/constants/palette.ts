import ValveIcon from "@/components/icons/ValveIcon";
import { PaletteItemType } from "@/types/palette.types";

export const paletteItems: PaletteItemType[] = [
  // BASIC
  {
    type: "button",
    label: "Button",
    category: "Basic",
    defaultProps: { label: "Button" },
  },
  {
    type: "text",
    label: "Text",
    category: "Basic",
    defaultProps: { text: "Text" },
  },

  // INDICATORS
  {
    type: "lamp",
    label: "Lamp",
    category: "Indicators",
    defaultProps: { value: false },
  },
  {
    type: "numeric",
    label: "Numeric Display",
    category: "Indicators",
    defaultProps: { value: 0 },
  },
  {
    type: "indicator",
    label: "Indicator",
    category: "Indicators",
    defaultProps: {value: 0}
  },

  // PROCESS
  {
    type: "valve",
    label: "Valve",
    category: "Process",
    iconComponent: ValveIcon,
    defaultProps: {},
  },
  {
    type: "tank",
    label: "Tank",
    category: "Process",
    defaultProps: { level: 50 },
  },

  // SHAPES
  {
    type: "line",
    label: "Line",
    category: "Shapes",
    defaultProps: {},
  },
];