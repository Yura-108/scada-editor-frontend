import {ElementType, PropertySchema} from "@/core/scene";

/**
 * Поля виджетов: индикаторы, элементы управления, текст, картинка, приборы, таблица, тренд,
 * график. Группа и пользовательский компонент своих полей не имеют — пустые списки стоят на
 * прежнем месте, чтобы порядок ключей `elementPropertyMap` не изменился.
 */
export const widgetFields = {
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
    // Подпись — `text`, а не `label`: `label` — название элемента (поле «Название» выше), и
    // общий ключ связывал их — переименование кнопки меняло надпись и наоборот.
    { key: "text", label: "Текст", type: "text", defaultValue: "Кнопка" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#ffffff" },
    { key: "fontSize", label: "Размер текста", type: "number", min: 8, max: 72, defaultValue: 16 },
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
    // Потолок в 1000 строк — не про рендер, а про смысл: таблица на тысячу строк это
    // список уставок целиком, и раньше он просто не помещался. Высота строки считается
    // от высоты таблицы (веса нормируются в tableLayout), поэтому таблицу под такое
    // число строк надо растянуть — иначе строки схлопнутся в неразличимую полосу.
    { key: "rows", label: "Строк", type: "number", min: 1, max: 1000, defaultValue: 4 },
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
    // Перья, окно и масштаб — на вкладке «Свойства» (TrendSettingsBlock): перо — это
    // тег-свойство, а его масштаб и цвет живут в `trend.pens`, общих min/max больше нет.
    { key: "title", label: "Заголовок", type: "text", defaultValue: "Тренд" },
    { key: "backgroundColor", label: "Цвет фона", type: "color", defaultValue: "#1e293b" },
    { key: "strokeColor", label: "Цвет рамки", type: "color", defaultValue: "#475569" },
    { key: "textColor", label: "Цвет текста", type: "color", defaultValue: "#94a3b8" },
    { key: "gridColor", label: "Цвет сетки", type: "color", defaultValue: "#1e3a5f" },
    { key: "showGrid", label: "Сетка", type: "boolean", defaultValue: true },
    { key: "showLegend", label: "Легенда перьев", type: "boolean", defaultValue: true },
    { key: "showDots", label: "Точки изменений", type: "boolean", defaultValue: false },
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
} satisfies Partial<Record<ElementType, PropertySchema[]>>;
