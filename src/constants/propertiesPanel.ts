import { DiagramElement, PropertySchema } from "@/types/editorElement.type";


export const basePropertySchema: PropertySchema[] = [
  {
    key: "x",
    label: "Position X",
    type: "number",
  },
  {
    key: "y",
    label: "Position Y",
    type: "number",
  },
  {
    key: "w",
    label: "Width",
    type: "number",
  },
  {
    key: "h",
    label: "Height",
    type: "number",
  },
  {
    key: "basic_label",
    label: "Label",
    type: "text",
  },
  {
    key: "bg",
    label: "Background",
    type: "color",
  },
];

export const elementPropertyMap: Record<DiagramElement["type"], PropertySchema[]> = {
  valve: [
    {
      key: "status",
      label: "Valve Status",
      type: "select",
      options: [
        { label: "Open", value: "open" },
        { label: "Closed", value: "closed" },
        { label: "Opening", value: "opening" },
        { label: "Closing", value: "closing" },
        { label: "Error", value: "error" },
      ],
      defaultValue: "closed",
    },
    {
      key: "fillColorOpen",
      label: "Open Fill Color",
      type: "color",
      defaultValue: "#00cc00", // зелёный
    },
    {
      key: "fillColorClosed",
      label: "Closed Fill Color",
      type: "color",
      defaultValue: "#ff4d4f", // красный
    },
  ],

  numeric: [
    {
      key: "value",
      label: "Displayed Value",
      type: "number",
      defaultValue: 0,
    },
    {
      key: "unit",
      label: "Unit",
      type: "text",
      placeholder: "°C, bar, % etc.",
    },
    {
      key: "precision",
      label: "Decimal Places",
      type: "number",
      min: 0,
      max: 6,
      defaultValue: 1,
    },
    {
      key: "minValue",
      label: "Min Scale",
      type: "number",
      defaultValue: 0,
    },
    {
      key: "maxValue",
      label: "Max Scale",
      type: "number",
      defaultValue: 100,
    },
  ],

  text: [
    {
      key: "text",
      label: "Text Content",
      type: "text",
    },
    {
      key: "fontSize",
      label: "Font Size",
      type: "number",
      min: 8,
      max: 72,
      defaultValue: 16,
    },
    {
      key: "color",
      label: "Text Color",
      type: "color",
      defaultValue: "#ffffff",
    },
    {
      key: "bold",
      label: "Bold",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "italic",
      label: "Italic",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "align",
      label: "Text Align",
      type: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
      defaultValue: "center",
    },
  ],

  // Новый элемент — Button
  button: [
    {
      key: "color",
      label: "Button Color",
      type: "color",
      defaultValue: "#FF4D4F",
    },
    {
      key: "label",
      label: "Button Label",
      type: "text",
      defaultValue: "Btn",
    },
    {
      key: "textColor",
      label: "Text Color",
      type: "color",
      defaultValue: "#ffffff",
    },
    {
      key: "size",
      label: "Size (px)",
      type: "number",
      min: 30,
      max: 120,
      defaultValue: 50,
    },
    {
      key: "pressed",
      label: "Pressed State (preview)",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "enabled",
      label: "Enabled",
      type: "boolean",
      defaultValue: true,
    },
  ],

  // Новый элемент — Indicator (световой индикатор / лампочка состояния)
  indicator: [
    {
      key: "status",
      label: "Indicator Status",
      type: "select",
      options: [
        { label: "Off", value: "off" },
        { label: "On", value: "on" },
        { label: "Error", value: "error" },
        { label: "Warning", value: "warning" },
      ],
      defaultValue: "off",
    },
    {
      key: "colorOn",
      label: "Color when ON",
      type: "color",
      defaultValue: "#00FF00", // ярко-зелёный
    },
    {
      key: "colorOff",
      label: "Color when OFF",
      type: "color",
      defaultValue: "#444444",
    },
    {
      key: "colorError",
      label: "Error Color",
      type: "color",
      defaultValue: "#FF0000",
    },
    {
      key: "glowIntensity",
      label: "Glow Strength",
      type: "number",
      min: 0,
      max: 1,
      step: 0.1,
      defaultValue: 0.4,
    },
    {
      key: "size",
      label: "Size (px)",
      type: "number",
      min: 20,
      max: 100,
      defaultValue: 30,
    },
  ],

  // Новый элемент — Lamp (лампа, похожа на indicator, но с базой/другим дизайном)
  lamp: [
    {
      key: "status",
      label: "Lamp State",
      type: "select",
      options: [
        { label: "Off", value: "off" },
        { label: "On", value: "on" },
        { label: "Blinking", value: "blinking" },
      ],
      defaultValue: "off",
    },
    {
      key: "color",
      label: "Lamp Color (when On)",
      type: "color",
      defaultValue: "#FFD700", // жёлтый/золотой
    },
    {
      key: "colorOff",
      label: "Off Color",
      type: "color",
      defaultValue: "#333333",
    },
    {
      key: "glowIntensity",
      label: "Glow / Halo Intensity",
      type: "number",
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 0.3,
    },
    {
      key: "size",
      label: "Size (px)",
      type: "number",
      min: 30,
      max: 150,
      defaultValue: 40,
    },
    {
      key: "showBase",
      label: "Show Base / Socket",
      type: "boolean",
      defaultValue: true,
    },
  ],

  tank: [
    {
      key: "level",
      label: "Fill Level (%)",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 60,
    },
    {
      key: "fluidColor",
      label: "Fluid Color",
      type: "color",
      defaultValue: "#3b82f6", // синий по умолчанию
    },
    {
      key: "strokeColor",
      label: "Border Color",
      type: "color",
      defaultValue: "#333333",
    },
    {
      key: "backgroundColor",
      label: "Tank Background",
      type: "color",
      defaultValue: "#e5e7eb", // светло-серый
    },
    {
      key: "showPercentage",
      label: "Show Percentage Text",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "textColor",
      label: "Percentage Text Color",
      type: "color",
      defaultValue: "#111111",
    },
    {
      key: "scaleLines",
      label: "Show Scale Lines",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "size",
      label: "Size Preset",
      type: "select",
      options: [
        { label: "Small", value: "small" },
        { label: "Medium", value: "medium" },
        { label: "Large", value: "large" },
      ],
      defaultValue: "medium",
    },
  ],
};