import type {DiagramElement, ElementType} from "@/core/scene";

/**
 * Названия типов элементов по-русски — для имени нового элемента и для «Слоёв», когда имени
 * нет. Раньше в «Слоях» шли вперемешку «Element», «arc», «progress_bar» (#18 п. 9, #10 п. 8).
 */
export const ELEMENT_TYPE_NAMES: Partial<Record<ElementType | "faceplate", string>> = {
  line: "Линия",
  circle: "Круг",
  arc: "Дуга",
  curve: "Кривая",
  polygon: "Многоугольник",
  path: "Контур",
  rectangle: "Прямоугольник",
  text: "Текст",
  image: "Картинка",
  progress_bar: "Прогресс-бар",
  checkbox: "Флажок",
  button: "Кнопка",
  toggle: "Тумблер",
  slider: "Слайдер",
  dropdown: "Выпадающий список",
  input: "Поле ввода",
  gauge: "Шкала",
  table: "Таблица",
  trend: "Тренд",
  chart: "График",
  group: "Группа",
  custom: "Компонент",
  faceplate: "Компонент",
};

/** Имя по умолчанию у элементов, созданных до русских имён. */
const LEGACY_DEFAULT_LABEL = "Element";

/**
 * Типы, у которых `label` рисуется на холсте как надпись (подпись флажка и тумблера, текст
 * кнопки, процент прогресс-бара, запасная надпись прямоугольника). Им номер в имени не ставим:
 * «Тумблер 3» появился бы на самой схеме.
 */
const LABEL_IS_CAPTION = new Set<ElementType>(["rectangle", "button", "checkbox", "toggle", "progress_bar"]);

/** Как показать элемент в «Слоях»: его имя, а без имени (или со старым «Element») — тип по-русски. */
export function elementDisplayName(el: Pick<DiagramElement, "label" | "type">): string {
  const label = typeof el.label === "string" ? el.label.trim() : "";
  if (label && label !== LEGACY_DEFAULT_LABEL) return label;
  return ELEMENT_TYPE_NAMES[el.type] ?? el.type;
}

/**
 * Имя нового элемента: «Круг 1», «Круг 2»… — следующий номер после наибольшего занятого
 * среди элементов схемы. `null` — имя не задаём (тип без русского названия или надпись на холсте).
 */
export function nextElementLabel(type: ElementType, elements: Pick<DiagramElement, "label">[]): string | null {
  const name = ELEMENT_TYPE_NAMES[type];
  if (!name || LABEL_IS_CAPTION.has(type)) return null;
  const prefix = `${name} `;
  let max = 0;
  for (const el of elements) {
    if (typeof el.label !== "string" || !el.label.startsWith(prefix)) continue;
    const n = Number(el.label.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${name} ${max + 1}`;
}
