import { DiagramElement } from "../types/editorElement.type";
import { ElementIndex } from "../element/elementIndex";
import { readActiveStates } from "../activeStates";
import { useRuntimeOverlayStore } from "../runtimeOverlayStore";
import { ElementBounds, elementBoundsRendered } from "./getElementBounds";

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

interface RootBoundsCache {
  states: Record<string, string>;
  overrides: Record<string, Record<string, unknown>>;
  byKey: Map<string, ElementBounds>;
}

/**
 * Границы корневых узлов, посчитанные для конкретной схемы.
 *
 * Отсечение пересчитывается на каждое движение камеры, а границы корня от камеры не
 * зависят: это обход всех его потомков с подъёмом по предкам и измерением текста. Без
 * кэша каждый кадр пана заново обходил всю схему ради того же ответа.
 *
 * Границы зависят ровно от трёх вещей: массива элементов (индекс кэширован по ссылке на
 * него), активных состояний и рантайм-оверрайдов монитора — их `getRenderedElement` читает
 * изнутри. Все три меняются только заменой объекта, поэтому сравнения ссылок достаточно:
 * сменилась любая — кэш схемы сбрасывается целиком. WeakMap не держит старые схемы в памяти.
 */
const rootBoundsCache = new WeakMap<ElementIndex, RootBoundsCache>();

const rootBoundsReader = (index: ElementIndex): ((el: DiagramElement) => ElementBounds) => {
  const states = readActiveStates();
  const overrides = useRuntimeOverlayStore.getState().overridesByKey;

  let cache = rootBoundsCache.get(index);
  if (!cache || cache.states !== states || cache.overrides !== overrides) {
    cache = {states, overrides, byKey: new Map()};
    rootBoundsCache.set(index, cache);
  }
  const {byKey} = cache;

  return (el) => {
    let bounds = byKey.get(el.key);
    if (!bounds) {
      bounds = elementBoundsRendered(el, index);
      byKey.set(el.key, bounds);
    }
    return bounds;
  };
};

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

  const boundsOf = rootBoundsReader(elementIndex);

  const keys: string[] = [];
  for (const el of rootElements) {
    if (alwaysVisible.has(el.key)) {
      keys.push(el.key);
      continue;
    }

    const b = boundsOf(el);
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
