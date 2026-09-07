import { DiagramElement } from "@/types/editorElement.type";
import { ElementIndex, getChildElements } from "@/lib/editor/elementIndex";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { getAbsoluteRenderedPos } from "@/lib/editor/getAbsoluteRenderedPos";
import { sortKeysByZIndex } from "@/lib/editor/zOrder";

/**
 * Хит-тест монитора: какой элемент **текущего уровня** находится под точкой.
 *
 * Почему своя функция, а не Konva. В режиме монитора основной слой холста идёт с
 * `listening={false}` (интерактив живёт в отдельном MonitorInteractionLayer), то есть
 * фигуры вообще вне хит-графа Konva и `e.target` всегда сам Stage. Зато нам и не нужен
 * подъём по дереву: вместо редакторского `resolveClickTarget` (снизу вверх — от
 * попавшей фигуры к предку нужного уровня) мы просто перебираем сверху вниз
 * кандидатов ровно того уровня, который сейчас открыт. Результат тот же.
 *
 * Уровень задаётся `activeGroupKey` — та же механика входа в группу, что и в
 * редакторе: null — корень сцены, иначе состав активного контейнера
 * (`composition` + `children` одним пулом, как их рисует GroupNode).
 *
 * Порядок перебора — обратный порядку отрисовки (`sortKeysByZIndex`), поэтому
 * побеждает верхняя фигура. Поворот игнорируется: берём осевой bbox, как это
 * делает отсечение по вьюпорту.
 */
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
    candidateKeys = [...(container.composition ?? []), ...(container.children ?? [])];
  } else {
    // Корень сцены берём тем же способом, что и рендер (Canvas.rootElements), —
    // через индекс, а не фильтром по массиву: правило «кто корневой» должно быть одно.
    candidateKeys = getChildElements(sceneId, elementIndex).map(el => el.key);
  }

  const ordered = sortKeysByZIndex(candidateKeys, byKey);

  for (let i = ordered.length - 1; i >= 0; i--) {
    const el = byKey[ordered[i]];
    if (!el || el.visible === false) continue;

    const rendered = getRenderedElement(el) as unknown as Record<string, unknown>;
    const w = Number(rendered.w) || 0;
    const h = Number(rendered.h) || 0;
    if (w <= 0 || h <= 0) continue;

    const { x, y } = getAbsoluteRenderedPos(el, byKey);
    if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) return el;
  }

  return null;
}

/** Контейнер, внутрь которого имеет смысл заходить двойным кликом. */
export const isMonitorContainer = (el: DiagramElement): boolean =>
  el.type === "group" || Boolean(el.children?.length) || Boolean(el.composition?.length);
