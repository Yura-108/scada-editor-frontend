import { RefObject, useCallback, useRef, useState } from "react";
import Konva from "konva";
import { snap } from "@/lib/utils";
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { collectGuideCandidates, findGuideMatch, type GuideCandidates } from "@/lib/editor/smartGuides";
import { DiagramElement } from "@/types/editorElement.type";

interface MultiDragAndGuidesDeps {
  stageRef: RefObject<Konva.Stage | null>;
  zoom: number;
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
  selectedIds: string[];
  moveSelectedBy: (dx: number, dy: number, excludeKey?: string) => void;
  /** Прячет hover-подсветку на старте перетаскивания — иначе рамка зависает на старом месте. */
  clearHover: () => void;
}

/**
 * Мульти-drag (тянем один выделенный элемент — остальные едут следом) + smart-guides
 * (магнит к рёбрам/центрам соседей) — обе сессии живут на уровне Stage, т.к.
 * drag-события Konva всплывают до него.
 */
export function useMultiDragAndGuides({
  stageRef,
  zoom,
  elements,
  elementsMap,
  selectedIds,
  moveSelectedBy,
  clearHover,
}: MultiDragAndGuidesDeps) {
  // ---- Мульти-drag: тянем один выделенный элемент — остальные едут следом. ----
  // Drag-события Konva всплывают до Stage; сессия стартует, только если цель
  // резолвится в выделенный элемент (ручки ресайза исключены по name).
  const multiDragRef = useRef<{
    draggedKey: string;
    draggedOrig: { x: number; y: number };
    others: { node: Konva.Node; orig: { x: number; y: number } }[];
  } | null>(null);

  // ---- Smart-guides: магнит к рёбрам/центрам соседей при перетаскивании ----
  const guideSessionRef = useRef<{
    target: Konva.Node;
    startPos: { x: number; y: number };
    startBounds: { minX: number; minY: number; maxX: number; maxY: number };
    candidates: GuideCandidates;
  } | null>(null);
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });

  const resolveDragKey = useCallback((target: Konva.Node): string | null => {
    if (target.name() === "resize-handle") return null;
    let node: Konva.Node | null = target;
    // Драггаться может и внутренний узел (Arrow у линии, Circle у круга) — id лежит на группе выше.
    for (let i = 0; i < 3 && node; i++) {
      const id = node.id();
      if (id && elementsMap[id]) return id;
      node = node.getParent();
    }
    return null;
  }, [elementsMap]);

  const handleStageDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    clearHover();

    const key = resolveDragKey(e.target);
    const stage = stageRef.current;
    if (!key || !stage) return;

    const selectedSet = new Set(selectedIds);

    // Smart-guides: соседи того же родителя (не выделенные) — их рёбра/центры.
    const el = elementsMap[key];
    if (el) {
      const candidateEls = elements.filter(c =>
        c.key !== key && !selectedSet.has(c.key) && c.parentKey === el.parentKey,
      );
      if (candidateEls.length) {
        const b = getElementBoundsRendered(el, elements);
        if (isFinite(b.minX)) {
          guideSessionRef.current = {
            target: e.target,
            startPos: e.target.position(),
            startBounds: b,
            candidates: collectGuideCandidates(elements, candidateEls),
          };
        }
      }
    }

    // Мульти-drag — только когда тянем один из ≥2 выделенных.
    if (selectedIds.length < 2 || !selectedIds.includes(key)) return;

    // Двигаем только верхнеуровневые выделенные — элемент с выделенным предком едет с ним.
    const hasSelectedAncestor = (k: string): boolean => {
      let pk = elementsMap[k]?.parentKey;
      while (pk) {
        if (selectedSet.has(pk)) return true;
        pk = elementsMap[pk]?.parentKey ?? null;
      }
      return false;
    };

    const others = selectedIds
      .filter(k => k !== key && !hasSelectedAncestor(k))
      .map(k => stage.findOne(`#${k}`))
      .filter((n): n is Konva.Node => Boolean(n))
      .map(n => ({ node: n, orig: n.position() }));

    if (!others.length) return;
    multiDragRef.current = { draggedKey: key, draggedOrig: e.target.position(), others };
  }, [selectedIds, elements, elementsMap, resolveDragKey, stageRef, clearHover]);

  const handleStageDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // 1) Smart-guides: примагничиваем перетаскиваемый элемент к рёбрам/центрам соседей.
    const gs = guideSessionRef.current;
    let guideV: number | null = null;
    let guideH: number | null = null;
    if (gs && e.target === gs.target) {
      const dx = e.target.x() - gs.startPos.x;
      const dy = e.target.y() - gs.startPos.y;
      // Порог экранно-постоянный (~6px независимо от зума).
      const threshold = 6 / zoom;
      const { minX, minY, maxX, maxY } = gs.startBounds;
      const mv = findGuideMatch(
        [minX + dx, (minX + maxX) / 2 + dx, maxX + dx],
        gs.candidates.v,
        threshold,
      );
      const mh = findGuideMatch(
        [minY + dy, (minY + maxY) / 2 + dy, maxY + dy],
        gs.candidates.h,
        threshold,
      );
      if (mv) { e.target.x(e.target.x() + mv.offset); guideV = mv.line; }
      if (mh) { e.target.y(e.target.y() + mh.offset); guideH = mh.line; }
    }
    setGuides(prev => (prev.v === guideV && prev.h === guideH) ? prev : { v: guideV, h: guideH });

    // 2) Мульти-drag: остальные выделенные следуют за (уже примагниченной) позицией.
    const session = multiDragRef.current;
    if (!session) return;
    const dx = e.target.x() - session.draggedOrig.x;
    const dy = e.target.y() - session.draggedOrig.y;
    for (const { node, orig } of session.others) {
      node.position({ x: orig.x + dx, y: orig.y + dy });
    }
  }, [zoom]);

  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    guideSessionRef.current = null;
    setGuides(prev => (prev.v === null && prev.h === null) ? prev : { v: null, h: null });

    const session = multiDragRef.current;
    if (!session) return;
    multiDragRef.current = null;

    // Дельта в терминах закоммиченного (снапнутого) значения перетащенного элемента.
    const dx = snap(e.target.x()) - session.draggedOrig.x;
    const dy = snap(e.target.y()) - session.draggedOrig.y;

    // Возвращаем императивно сдвинутые узлы на исходные позиции ДО коммита:
    // у линий/кругов группа не имеет controlled x/y, и React сам не сбросил бы сдвиг.
    for (const { node, orig } of session.others) node.position(orig);

    moveSelectedBy(dx, dy, session.draggedKey);
  }, [moveSelectedBy]);

  return { guides, handleStageDragStart, handleStageDragMove, handleStageDragEnd };
}
