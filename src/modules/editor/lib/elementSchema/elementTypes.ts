import {ElementType} from "@/core/scene";

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
  curve: { complex: false },
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
  curve: "Кривая линия",
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
