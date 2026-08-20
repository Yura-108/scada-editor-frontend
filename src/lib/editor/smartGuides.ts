import { DiagramElement } from "@/types/editorElement.type";
import { getElementBoundsRendered } from "@/lib/getElementBounds";

export interface GuideCandidates {
  /** Вертикальные линии (координаты X): левый край / центр / правый край соседей. */
  v: number[];
  /** Горизонтальные линии (координаты Y): верх / центр / низ соседей. */
  h: number[];
}

/** Собирает направляющие-кандидаты по рёбрам и центрам соседних элементов (абсолютные координаты). */
export function collectGuideCandidates(
  elements: DiagramElement[],
  candidateElements: DiagramElement[],
): GuideCandidates {
  const v: number[] = [];
  const h: number[] = [];
  for (const el of candidateElements) {
    const b = getElementBoundsRendered(el, elements);
    if (!isFinite(b.minX)) continue;
    v.push(b.minX, (b.minX + b.maxX) / 2, b.maxX);
    h.push(b.minY, (b.minY + b.maxY) / 2, b.maxY);
  }
  return { v, h };
}

export interface GuideMatch {
  /** На сколько сдвинуть элемент, чтобы ребро легло на направляющую. */
  offset: number;
  /** Координата направляющей (для отрисовки линии). */
  line: number;
}

/** Ближайшая направляющая к одному из рёбер перетаскиваемого (в пределах threshold). */
export function findGuideMatch(edges: number[], lines: number[], threshold: number): GuideMatch | null {
  let best: GuideMatch | null = null;
  for (const edge of edges) {
    for (const line of lines) {
      const offset = line - edge;
      if (Math.abs(offset) <= threshold && (!best || Math.abs(offset) < Math.abs(best.offset))) {
        best = { offset, line };
      }
    }
  }
  return best;
}
