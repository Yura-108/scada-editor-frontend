import { DiagramElement } from "@/types/editorElement.type";
import { ElementIndex, getChildElements } from "@/lib/editor/elementIndex";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { sortKeysByZIndex } from "@/lib/editor/zOrder";

/**
 * Хит-тест монитора: какой элемент находится под точкой.
 *
 * Почему своя функция, а не Konva. В режиме монитора основной слой холста идёт с
 * `listening={false}` (интерактив живёт в отдельном MonitorInteractionLayer), то есть
 * фигуры вообще вне хит-графа Konva и `e.target` всегда сам Stage.
 *
 * **Спуск до самого глубокого.** Раньше перебирался только текущий уровень, и в корне
 * ответом всегда была внешняя группа — по всей её рамке, включая пустые углы. При этом
 * `onClick`-скрипты уже работали точечно: `MonitorInteractionLayer` кладёт прямоугольник
 * на каждый элемент с обработчиком на ЛЮБОЙ глубине, и Konva берёт верхний, то есть самый
 * глубокий. Одна и та же точка экрана давала разный элемент для меню и для события; теперь
 * оба пути указывают на один элемент.
 *
 * Уровень, с которого начинается спуск, по-прежнему задаёт `activeGroupKey` — вход и выход
 * из группы работают как раньше.
 *
 * Порядок перебора на каждом уровне — обратный порядку отрисовки (`sortKeysByZIndex`),
 * поэтому побеждает верхняя фигура. Поворот игнорируется: берём осевой bbox, как это
 * делает отсечение по вьюпорту. У повёрнутого элемента края меню и события поэтому могут
 * разойтись — прямоугольники слоя интеракции поворот учитывают.
 */

/** Ключи членов контейнера в порядке отрисовки — composition и children одним пулом. */
const memberKeysOf = (el: DiagramElement): string[] =>
  [...(el.composition ?? []), ...(el.children ?? [])];

/** Попадает ли точка в осевой габарит элемента. */
function hitsElement(
  point: { x: number; y: number },
  el: DiagramElement,
  byKey: Record<string, DiagramElement>,
): boolean {
  if (el.visible === false) return false;

  const rendered = getRenderedElement(el) as unknown as Record<string, unknown>;
  const w = Number(rendered.w) || 0;
  const h = Number(rendered.h) || 0;
  if (w <= 0 || h <= 0) return false;

  const { x, y } = getAbsoluteRenderedPos(el, byKey);
  return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
}

/**
 * Самый глубокий элемент под точкой среди перечисленных ключей и их потомков.
 *
 * Возвращает попавшийся контейнер, если ни один его потомок под точку не подошёл, — так
 * клик в отступ группы достаётся самой группе, а не проваливается мимо.
 */
function pickDeepest(
  point: { x: number; y: number },
  keys: string[],
  byKey: Record<string, DiagramElement>,
): DiagramElement | null {
  const ordered = sortKeysByZIndex(keys, byKey);

  for (let i = ordered.length - 1; i >= 0; i--) {
    const el = byKey[ordered[i]];
    if (!el || !hitsElement(point, el, byKey)) continue;

    const members = memberKeysOf(el);
    if (members.length) {
      const deeper = pickDeepest(point, members, byKey);
      if (deeper) return deeper;
    }
    return el;
  }

  return null;
}

export function pickMonitorTarget(
  point: { x: number; y: number },
  opts: {
    elementIndex: ElementIndex;
    activeGroupKey: string | null;
    sceneId: string;
  },
): DiagramElement | null {
  const { elementIndex, activeGroupKey, sceneId } = opts;
  const { byKey } = elementIndex;

  let candidateKeys: string[];
  if (activeGroupKey) {
    const container = byKey[activeGroupKey];
    if (!container) return null;
    candidateKeys = memberKeysOf(container);
  } else {
    // Корень сцены берём тем же способом, что и рендер (Canvas.rootElements), —
    // через индекс, а не фильтром по массиву: правило «кто корневой» должно быть одно.
    candidateKeys = getChildElements(sceneId, elementIndex).map(el => el.key);
  }

  return pickDeepest(point, candidateKeys, byKey);
}

/**
 * Контейнер под точкой — для входа внутрь двойным кликом.
 *
 * Отдельно от `pickMonitorTarget`: тот отдаёт самый глубокий элемент, а это, как правило,
 * лист, и вход в группу по нему не сработал бы вовсе. Здесь нужен САМЫЙ ГЛУБОКИЙ КОНТЕЙНЕР
 * на пути вниз — двойной клик по вложенному компоненту заводит именно в него, а не в его
 * внешнюю группу.
 */
export function pickMonitorContainer(
  point: { x: number; y: number },
  opts: {
    elementIndex: ElementIndex;
    activeGroupKey: string | null;
    sceneId: string;
  },
): DiagramElement | null {
  const { elementIndex, activeGroupKey, sceneId } = opts;
  const { byKey } = elementIndex;

  let candidateKeys: string[];
  if (activeGroupKey) {
    const container = byKey[activeGroupKey];
    if (!container) return null;
    candidateKeys = memberKeysOf(container);
  } else {
    candidateKeys = getChildElements(sceneId, elementIndex).map(el => el.key);
  }

  let found: DiagramElement | null = null;
  let keys = candidateKeys;

  // Спускаемся, запоминая последний контейнер: он и есть ответ, если глубже контейнеров нет.
  for (;;) {
    const ordered = sortKeysByZIndex(keys, byKey);
    let hit: DiagramElement | null = null;

    for (let i = ordered.length - 1; i >= 0; i--) {
      const el = byKey[ordered[i]];
      if (el && hitsElement(point, el, byKey)) { hit = el; break; }
    }

    if (!hit) return found;
    if (isMonitorContainer(hit)) found = hit;

    const members = memberKeysOf(hit);
    if (!members.length) return found;
    keys = members;
  }
}

/** Контейнер, внутрь которого имеет смысл заходить двойным кликом. */
export const isMonitorContainer = (el: DiagramElement): boolean =>
  el.type === "group" || Boolean(el.children?.length) || Boolean(el.composition?.length);
