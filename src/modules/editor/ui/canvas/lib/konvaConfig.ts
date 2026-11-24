import Konva from "konva";

/**
 * Глобальные настройки Konva для холста редактора.
 *
 * Модуль импортируется ради побочного эффекта (см. Canvas.tsx) — настройки
 * глобальные и должны примениться до создания Stage.
 */

/**
 * Порог начала перетаскивания в пикселях.
 *
 * По умолчанию Konva стартует drag от нулевого смещения, поэтому дрожание мыши
 * на 1px при обычном клике запускало жест: `onDragEnd` писал координаты в стор,
 * схема помечалась изменённой и в историю уходил шаг undo «из ничего».
 */
Konva.dragDistance = 3;

/**
 * Отключаем «идеальную отрисовку» там, где её не просили явно.
 *
 * Фигуру с заливкой и обводкой Konva по умолчанию рисует через промежуточный
 * буферный canvas — ради безупречного стыка обводки с заливкой при
 * полупрозрачности. На схеме из сотен элементов это лишний буфер на фигуру в
 * каждом кадре перетаскивания.
 *
 * Значение по умолчанию задано в самом Konva через `?? true` внутри
 * `_useBufferCanvas`, поэтому переопределяем именно его: явное
 * `perfectDrawEnabled` у фигуры (если где-то понадобится) продолжает работать.
 *
 * Видимая разница возможна только у фигуры с заливкой И обводкой И
 * прозрачностью — там стык обводки с заливкой станет чуть заметнее.
 */
type BufferCanvasHost = { attrs: Record<string, unknown> };
const originalUseBufferCanvas = Konva.Shape.prototype._useBufferCanvas;
Konva.Shape.prototype._useBufferCanvas = function (this: BufferCanvasHost, forceFill?: boolean) {
  if (this.attrs.perfectDrawEnabled === undefined) return false;
  return originalUseBufferCanvas.call(this as unknown as Konva.Shape, forceFill);
};
