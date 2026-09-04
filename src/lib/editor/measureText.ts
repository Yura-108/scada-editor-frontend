import Konva from "konva";
import {LeafElement} from "@/types/editorElement.type";

/**
 * Настоящий габарит текстового элемента.
 *
 * У текста `w/h` в модели — фикция: элемент рождается общей веткой `addElementAt`
 * с `80×80`, `h` не пишется вообще ничем, а ширину пользователь задаёт только явным
 * растягиванием ручки. Реальный размер знает лишь Konva, измерив глифы. Раньше это
 * измерение жило внутри `TextShapeElement` и наружу не выходило — поэтому границы
 * (`getElementBounds`), рамки групп, направляющие и поворот считали текст квадратом
 * 80×80 и уводили его не туда.
 *
 * Здесь — единственный источник этого габарита. Функция горячая (границы дёргаются на
 * каждый расчёт рамки), поэтому результат мемоизируется по видимым параметрам текста.
 */

interface TextSize {
  w: number;
  h: number;
}

/** Потолок кэша: ключей ровно столько, сколько различных подписей на схеме. */
const CACHE_LIMIT = 500;
const cache = new Map<string, TextSize>();

/** Режим ширины — тот же, что в рендерере: фикс. ширина только после растягивания. */
const fixedWidthOf = (el: Partial<LeafElement>): number | undefined =>
  el.autoWidth === false && el.w ? el.w : undefined;

/**
 * Габарит текста от его левого верхнего угла (`x, y` элемента — начало узла `Text`).
 *
 * Значения по умолчанию обязаны совпадать с `TextShapeElement`: панель, выделение и
 * геометрия должны описывать ровно то, что нарисовано.
 */
export function measureText(el: Partial<LeafElement>): TextSize {
  const fontSize = el.fontSize ?? 16;
  const text = el.text ?? "Текст";
  const fontFamily = el.fontFamily || "Arial";
  const fontStyle = el.bold ? "bold" : "normal";
  const width = fixedWidthOf(el);

  const key = `${text}|${fontSize}|${fontFamily}|${fontStyle}|${width ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Konva меряет через <canvas>: на сервере измерять нечем, отдаём грубую оценку.
  // В рендер она не попадает (холст живёт только в браузере), но защищает расчёты
  // геометрии от падения, если их когда-нибудь вызовут вне окна.
  const size: TextSize = typeof document === "undefined"
    ? {w: width ?? text.length * fontSize * 0.6, h: fontSize * 1.2}
    : measureWithKonva(text, fontSize, fontFamily, fontStyle, width);

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, size);
  return size;
}

function measureWithKonva(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
  width: number | undefined,
): TextSize {
  const node = new Konva.Text({text, fontSize, fontFamily, fontStyle, width});
  // При фиксированной ширине габарит — она сама: `getTextWidth` вернёт ширину самой
  // длинной строки после переноса, а рамка должна совпадать с заданной коробкой.
  const size = {w: width ?? node.getTextWidth(), h: node.height()};
  node.destroy();
  return size;
}
