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
];