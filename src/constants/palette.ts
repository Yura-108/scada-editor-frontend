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
    id: 10 ** 5 + 2,
    type: "arc",
    name: "Дуга",
    category: "Базовые",
    // Радиус 60 = три клетки, раствор 90° — четверть окружности. Габарит 120×120
    // (описанный квадрат) кратен сетке, поэтому дуга ложится по клеткам сразу.
    defaultProps: {name: "Arc", w: 120, h: 120, radius: 60, innerRadius: 0, angle: 90, rotate: 0, bg: "transparent", strokeColor: "#9ca3af", strokeWidth: 2},
  },
  {
    id: 10 ** 5 + 6,
    type: "curve",
    name: "Кривая линия",
    category: "Базовые",
    // Арка 160×60: концы внизу, направляющие сверху — сразу видно, что фигура гнётся.
    defaultProps: {name: "Curve", w: 160, h: 60, points: [0, 60, 40, 0, 120, 0, 160, 60], strokeColor: "#9ca3af", strokeWidth: 2},
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
  {
    id: 10 ** 5 + 5,
    type: "image",
    name: "Картинка",
    category: "Базовые",
    // При перетаскивании на холст открывается проводник для выбора файла
    // (см. обработчик drop в EditorClient) — src проставляется после выбора.
    defaultProps: {name: "Image", objectFit: "contain"}
  },

  // БАЗОВЫЕ — индикаторы
  {
    id: 10 ** 5 + 7,
    type: "progress_bar",
    name: "Прогресс-бар",
    category: "Базовые",
    defaultProps: {value: 50, w: 200, h: 20, orientation: "horizontal", color: "#3b82f6", bg: "#e5e7eb", textColor: "#ffffff", showPercentage: true},
  },
  {
    id: 10 ** 5 + 8,
    type: "checkbox",
    name: "Чекбокс",
    category: "Базовые",
    defaultProps: {checked: false, label: "Checkbox", w: 160, h: 20, color: "#3b82f6"},
  },

  // УПРАВЛЕНИЕ
  {
    id: 10 ** 5 + 10,
    type: "button",
    name: "Кнопка",
    category: "Управление",
    defaultProps: {label: "Кнопка", w: 120, h: 40, color: "#3b82f6", textColor: "#ffffff", rx: 6, pressed: false, enabled: true},
  },
  {
    id: 10 ** 5 + 11,
    type: "toggle",
    name: "Тумблер",
    category: "Управление",
    defaultProps: {checked: false, label: "", w: 40, h: 20, color: "#22c55e", backgroundColor: "#9ca3af", textColor: "#e5e7eb"},
  },
  {
    id: 10 ** 5 + 12,
    type: "slider",
    name: "Слайдер",
    category: "Управление",
    defaultProps: {value: 50, min: 0, max: 100, w: 160, h: 20, color: "#3b82f6", backgroundColor: "#d1d5db"},
  },
  {
    id: 10 ** 5 + 13,
    type: "dropdown",
    name: "Выпадающий список",
    category: "Управление",
    defaultProps: {value: "Выбор", w: 160, h: 40, backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a"},
  },
  {
    id: 10 ** 5 + 14,
    type: "input",
    name: "Поле ввода",
    category: "Управление",
    defaultProps: {value: "", placeholder: "Введите...", w: 160, h: 40, backgroundColor: "#ffffff", strokeColor: "#9ca3af", textColor: "#1a1a1a"},
  },

  // ВИЗУАЛИЗАЦИЯ
  {
    id: 10 ** 5 + 15,
    type: "gauge",
    name: "Гаус",
    category: "Визуализация",
    defaultProps: {value: 60, min: 0, max: 100, unit: "", w: 200, h: 200, color: "#3b82f6", backgroundColor: "#1e293b", strokeColor: "#475569", textColor: "#f8fafc", showValue: true, arcStart: -220, arcEnd: 40},
  },
  {
    id: 10 ** 5 + 16,
    type: "table",
    name: "Таблица",
    category: "Визуализация",
    defaultProps: {rows: 4, cols: 3, headerText: "Таблица", w: 300, h: 160, backgroundColor: "transparent", headerColor: "transparent", strokeColor: "#000000", textColor: "#000000", fontSize: 12, showHeader: true, alternateRow: false, alternateColor: "#f1f5f9", cells: {}},
  },
  {
    id: 10 ** 5 + 17,
    type: "trend",
    name: "Тренды",
    category: "Визуализация",
    defaultProps: {w: 300, h: 160, lineColor: "#3b82f6", backgroundColor: "#1e293b", strokeColor: "#475569", textColor: "#94a3b8", gridColor: "#1e3a5f", showGrid: true, showDots: false, filled: false, fillColor: "#1d4ed8", title: "Тренд", min: 0, max: 100},
  },
  {
    id: 10 ** 5 + 18,
    type: "chart",
    name: "График",
    category: "Визуализация",
    defaultProps: {chartType: "bar", w: 300, h: 200, barColor: "#3b82f6", backgroundColor: "#1e293b", strokeColor: "#475569", textColor: "#94a3b8", gridColor: "#1e3a5f", showGrid: true, showValues: true, orientation: "vertical", title: "График"},
  },
];