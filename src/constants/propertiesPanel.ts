import {ElementType, PropertySchema} from "@/types/editorElement.type";

export const elementRegistry: Record<ElementType, { complex: boolean }> = {
  button: { complex: false },
  progress_bar: { complex: false },
  checkbox: { complex: false },
  text: { complex: false },
  polygon: { complex: false },
  path: { complex: false },
  rectangle: { complex: false },
  circle: { complex: false },
  arc: { complex: false },
  line: { complex: false },
  group: { complex: false },
  toggle: { complex: false },
  slider: { complex: false },
  dropdown: { complex: false },
  input: { complex: false },
  image: { complex: false },
  custom: {complex: true},
  gauge: { complex: false },
  table: { complex: false },
  trend: { complex: false },
  chart: { complex: false },
};


/**
 * Русские названия типов элементов.
 *
 * Заголовок панели свойств собирался как `${type} Properties` — в полностью
 * русском интерфейсе получалось «Progress_bar Properties»: английское слово
 * плюс сырой snake_case идентификатор типа.
 */
export const elementTypeLabels: Record<ElementType, string> = {
  button: "Кнопка",
  progress_bar: "Индикатор выполнения",
  checkbox: "Флажок",
  text: "Текст",
  polygon: "Многоугольник",
  path: "Кривая",
  rectangle: "Прямоугольник",
  circle: "Окружность",
  arc: "Дуга",
  line: "Линия",
  group: "Группа",
  toggle: "Переключатель",
  slider: "Ползунок",
  dropdown: "Выпадающий список",
  input: "Поле ввода",
  image: "Изображение",
  custom: "Компонент",
  gauge: "Стрелочный прибор",
  table: "Таблица",
  trend: "График",
  chart: "Диаграмма",
};

/** Название типа для интерфейса; неизвестный тип показываем как есть. */
export const elementTypeLabel = (type: string): string =>
  elementTypeLabels[type as ElementType] ?? type;

/**
 * Типы, рендерер которых реально применяет `rotation={rendered.rotate || 0}`.
 *
 * Поле «Поворот°» показывалось для всех типов кроме `group`, но у `polygon`,
 * `circle`, `line`, текста и таблицы поворот никуда не прокидывается — значение
 * записывалось в элемент и молча не давало эффекта. Список держим здесь, рядом
 * с реестром: при добавлении rotation в очередную фигуру её нужно внести сюда.
 */
export const ROTATABLE_TYPES: ReadonlySet<ElementType> = new Set<ElementType>([
  "rectangle",
  "button",
  "checkbox",
  "dropdown",
  "image",
  "input",
  "progress_bar",
  "slider",
  "toggle",
]);

export const basePropertySchema: PropertySchema[] = [
  {
    key: "label",
    label: "Название",
    type: "text",
  },
];

/**
 * Стиль обводки — один и тот же пункт у всех фигур с контуром.
 *
 * Значение уходит в `strokeDasharray` и разбирается общим `parseDashArray`
 * (`lib/editor/dashArray.ts`), который читают все ветки рендера.
 */
const DASH_FIELD: PropertySchema = {
  key: "strokeDasharray",
  label: "Стиль (пунктир)",
  type: "select",
  options: [
    {label: "Сплошная", value: ""},
    {label: "Пунктир", value: "5 5"},
    {label: "Штрих-пунктир", value: "10 5 2 5"},
  ],
  defaultValue: "",
};

export const elementPropertyMap: Record<ElementType, PropertySchema[]> = {
  rectangle: [
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
      label: "Path (d)",
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
  progress_bar: [
    {
      key: "value",
      label: "Значение (%)",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 50,
    },
    {
      key: "orientation",
      label: "Ориентация",
      type: "select",
      options: [
        {label: "Горизонтальная", value: "horizontal"},
        {label: "Вертикальная", value: "vertical"},
      ],
      defaultValue: "horizontal",
    },
    {
      key: "label",
      label: "Заголовок",
      type: "text",
      defaultValue: "Progress",
    },
    {
      key: "color",
      label: "Цвет полосы",
      type: "color",
      defaultValue: "#3b82f6",
    },
    {
      key: "backgroundColor",
      label: "Цвет фона",
      type: "color",
      defaultValue: "#1e293b",
    },
    {
      key: "strokeColor",
      label: "Цвет рамки",
      type: "color",
      defaultValue: "#475569",
    },
    {
      key: "textColor",
      label: "Цвет текста",
      type: "color",
      defaultValue: "#f8fafc",
    },
    {
      key: "showPercentage",
      label: "Показывать проценты",
      type: "boolean",
      defaultValue: true,
    },
  ],
  checkbox: [
    {
      key: "checked",
      label: "Отмечен",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "label",
      label: "Подпись",
      type: "text",
      defaultValue: "Checkbox",
    },
    {
      key: "color",
      label: "Цвет при отметке",
      type: "color",
      defaultValue: "#3b82f6",
    },
    {
      key: "backgroundColor",
      label: "Цвет фона",
      type: "color",
      defaultValue: "#0f172a",
    },
    {
      key: "strokeColor",
      label: "Цвет рамки",
      type: "color",
      defaultValue: "#94a3b8",
    },
    {
      key: "textColor",
      label: "Цвет текста",
      type: "color",
      defaultValue: "#f1f5f9",
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
      key: "align",
      label: "Text Align",
      type: "select",
      options: [
        {label: "Left", value: "left"},
        {label: "Center", value: "center"},
        {label: "Right", value: "right"},
      ],
      defaultValue: "center",
    },
    {
      key: "bold",
      label: "Bold",
      type: "boolean",
      defaultValue: false,
    },
  ],
  button: [
    { key: "color", label: "Цвет фона", type: "color", defaultValue: "#3b82f6" },
    { key: "label", label: "Текст", type: "text", defaultValue: "Кнопка" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#ffffff" },
    { key: "rx", label: "Скругление углов", type: "number", min: 0, max: 40, defaultValue: 6 },
    { key: "pressed", label: "Нажата (превью)", type: "boolean", defaultValue: false },
    { key: "enabled", label: "Активна", type: "boolean", defaultValue: true },
  ],
  toggle: [
    { key: "checked", label: "Включен", type: "boolean", defaultValue: false },
    { key: "label", label: "Подпись", type: "text", defaultValue: "" },
    { key: "color", label: "Цвет (вкл)", type: "color", defaultValue: "#22c55e" },
    { key: "backgroundColor", label: "Цвет (выкл)", type: "color", defaultValue: "#9ca3af" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#e5e7eb" },
  ],
  slider: [
    { key: "value", label: "Значение", type: "number", defaultValue: 50 },
    { key: "min", label: "Минимум", type: "number", defaultValue: 0 },
    { key: "max", label: "Максимум", type: "number", defaultValue: 100 },
    { key: "color", label: "Цвет заполнения", type: "color", defaultValue: "#3b82f6" },
    { key: "backgroundColor", label: "Цвет трека", type: "color", defaultValue: "#d1d5db" },
  ],
  dropdown: [
    { key: "value", label: "Значение", type: "text", defaultValue: "Выбор" },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#ffffff" },
    { key: "strokeColor", label: "Цвет рамки", type: "color", defaultValue: "#9ca3af" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#1a1a1a" },
  ],
  input: [
    { key: "value", label: "Значение", type: "text", defaultValue: "" },
    { key: "placeholder", label: "Подсказка", type: "text", defaultValue: "Введите..." },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#ffffff" },
    { key: "strokeColor", label: "Цвет рамки", type: "color", defaultValue: "#9ca3af" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#1a1a1a" },
  ],
  image: [
    {
      key: "objectFit",
      label: "Вписывание",
      type: "select",
      options: [
        { label: "Вписать (по размеру)", value: "contain" },
        { label: "Заполнить (обрезка)", value: "cover" },
        { label: "Растянуть", value: "fill" },
      ],
      defaultValue: "contain",
    },
  ],
  group: [],
  custom: [],
  gauge: [
    { key: "value", label: "Значение", type: "number", min: 0, max: 100, step: 1, defaultValue: 60 },
    { key: "min", label: "Минимум", type: "number", defaultValue: 0 },
    { key: "max", label: "Максимум", type: "number", defaultValue: 100 },
    { key: "unit", label: "Единица измерения", type: "text", defaultValue: "" },
    { key: "precision", label: "Знаков после запятой", type: "number", min: 0, max: 3, defaultValue: 0 },
    { key: "color", label: "Цвет стрелки", type: "color", defaultValue: "#3b82f6" },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#1e293b" },
    { key: "strokeColor", label: "Цвет шкалы", type: "color", defaultValue: "#475569" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#f8fafc" },
    { key: "showValue", label: "Показывать значение", type: "boolean", defaultValue: true },
    { key: "arcStart", label: "Начало дуги (°)", type: "number", min: -270, max: 0, defaultValue: -220 },
    { key: "arcEnd", label: "Конец дуги (°)", type: "number", min: 0, max: 270, defaultValue: 40 },
  ],
  table: [
    { key: "rows", label: "Строк", type: "number", min: 1, max: 20, defaultValue: 4 },
    { key: "cols", label: "Столбцов", type: "number", min: 1, max: 10, defaultValue: 3 },
    { key: "headerText", label: "Заголовок", type: "text", defaultValue: "Таблица" },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#1e293b" },
    { key: "headerColor", label: "Цвет заголовка", type: "color", defaultValue: "#334155" },
    { key: "strokeColor", label: "Цвет рамки", type: "color", defaultValue: "#475569" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#f8fafc" },
    { key: "fontSize", label: "Размер шрифта", type: "number", min: 8, max: 24, defaultValue: 12 },
    { key: "showHeader", label: "Показывать заголовок", type: "boolean", defaultValue: true },
    { key: "alternateRow", label: "Чередовать строки", type: "boolean", defaultValue: true },
    { key: "alternateColor", label: "Цвет чётных строк", type: "color", defaultValue: "#0f172a" },
  ],
  trend: [
    { key: "title", label: "Заголовок", type: "text", defaultValue: "Тренд" },
    { key: "lineColor", label: "Цвет линии", type: "color", defaultValue: "#3b82f6" },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#1e293b" },
    { key: "strokeColor", label: "Цвет рамки", type: "color", defaultValue: "#475569" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#94a3b8" },
    { key: "gridColor", label: "Цвет сетки", type: "color", defaultValue: "#1e3a5f" },
    { key: "showGrid", label: "Сетка", type: "boolean", defaultValue: true },
    { key: "showDots", label: "Точки данных", type: "boolean", defaultValue: false },
    { key: "filled", label: "Заливка под линией", type: "boolean", defaultValue: false },
    { key: "fillColor", label: "Цвет заливки", type: "color", defaultValue: "#1d4ed8" },
    { key: "min", label: "Мин. значение оси Y", type: "number", defaultValue: 0 },
    { key: "max", label: "Макс. значение оси Y", type: "number", defaultValue: 100 },
  ],
  chart: [
    { key: "title", label: "Заголовок", type: "text", defaultValue: "График" },
    { key: "chartType", label: "Тип графика", type: "select", options: [
      { label: "Столбчатый", value: "bar" },
      { label: "Линейный", value: "line" },
      { label: "Область", value: "area" },
    ], defaultValue: "bar" },
    { key: "orientation", label: "Ориентация", type: "select", options: [
      { label: "Вертикальный", value: "vertical" },
      { label: "Горизонтальный", value: "horizontal" },
    ], defaultValue: "vertical" },
    { key: "barColor", label: "Цвет столбцов", type: "color", defaultValue: "#3b82f6" },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#1e293b" },
    { key: "strokeColor", label: "Цвет рамки", type: "color", defaultValue: "#475569" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#94a3b8" },
    { key: "gridColor", label: "Цвет сетки", type: "color", defaultValue: "#1e3a5f" },
    { key: "showGrid", label: "Сетка", type: "boolean", defaultValue: true },
    { key: "showValues", label: "Значения на столбцах", type: "boolean", defaultValue: true },
  ],
};