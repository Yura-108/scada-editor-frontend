import { DiagramElement } from "@/types/editorElement.type";
import { ElementIndex } from "@/lib/editor/elementIndex";
import { elementBoundsRendered } from "@/lib/getElementBounds";

/**
 * Схемы меньше этого размера отдаём целиком: отсечение само по себе стоит
 * прохода по корневым узлам, и на маленькой сцене оно только мешает.
 */
const CULLING_MIN_ELEMENTS = 200;

/**
 * Запас вокруг видимой области (в долях от её размера).
 *
 * Нужен, чтобы набор узлов не пересобирался на каждый пиксель панорамирования:
 * монтирование и размонтирование Konva-узлов дороже их отрисовки, и отсечение
 * «впритык» дало бы дёрганье вместо выигрыша.
 */
const MARGIN_RATIO = 0.5;

interface Params {
  /** Корневые узлы сцены в порядке отрисовки. */
  rootElements: DiagramElement[];
  elementIndex: ElementIndex;
  camera: { x: number; y: number; zoom: number };
  canvasRect: DOMRect | null;
  /** Выделенное рисуем всегда: к нему цепляется Transformer и мульти-drag. */
  selectedIds: string[];
  /** Активную группу тоже рисуем всегда — из неё пользователь работает. */
  activeGroupKey: string | null;
}

/**
 * Ключи корневых узлов, которые нужно смонтировать: попадающие в расширенную
 * видимую область плюс выделенные и активная группа.
 *
 * Порядок исходного массива сохраняется — он задаёт порядок отрисовки (z-order).
 */
export function selectVisibleRootKeys({
  rootElements,
  elementIndex,
  camera,
  canvasRect,
  selectedIds,
  activeGroupKey,
}: Params): string[] {
  if (rootElements.length < CULLING_MIN_ELEMENTS || !canvasRect || camera.zoom <= 0) {
    return rootElements.map(el => el.key);
  }

  // Экран → мир: Stage.x()===camera.x, Stage.scaleX()===camera.zoom.
  const worldW = canvasRect.width / camera.zoom;
  const worldH = canvasRect.height / camera.zoom;
  const marginX = worldW * MARGIN_RATIO;
  const marginY = worldH * MARGIN_RATIO;

  const minX = -camera.x / camera.zoom - marginX;
  const minY = -camera.y / camera.zoom - marginY;
  const maxX = minX + worldW + marginX * 2;
  const maxY = minY + worldH + marginY * 2;

  const alwaysVisible = new Set(selectedIds);
  if (activeGroupKey) alwaysVisible.add(activeGroupKey);

  const keys: string[] = [];
  for (const el of rootElements) {
    if (alwaysVisible.has(el.key)) {
      keys.push(el.key);
      continue;
    }

    const b = elementBoundsRendered(el, elementIndex);
    // Пустая группа даёт неконечные границы — такие оставляем на холсте.
    if (!isFinite(b.minX)) {
      keys.push(el.key);
      continue;
    }

    if (b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY) {
      keys.push(el.key);
    }
  }

  return keys;
}
