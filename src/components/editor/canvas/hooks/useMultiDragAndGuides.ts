import { RefObject, useCallback, useRef, useState } from "react";
import Konva from "konva";
import { snap } from "@/lib/utils";
import { getElementBoundsRendered } from "@/lib/getElementBounds";
import { collectGuideCandidates, findGuideMatch, type GuideCandidates } from "@/lib/editor/smartGuides";
import { DiagramElement } from "@/types/editorElement.type";
import { beginHistoryGroup, endHistoryGroup } from "@/lib/editor/historyGroup";

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

interface DragSession {
  key: string;
  /** Узел, который тянет Konva. Проверка `e.target === target` отсекает чужие события. */
  target: Konva.Node;
  /**
   * Позицию узла можно привязать к сетке напрямую (а не шагами от начала жеста).
   *
   * Так у корневых узлов элемента (их `id` равен ключу) и у КРУГА: у линии и полигона
   * тянется внутренняя фигура, чьи координаты — смещение внутри элемента, и снапить их
   * бессмысленно, а у круга та же внутренняя фигура стоит в координатах родителя, и её
   * позиция — это ЦЕНТР. Его и сажаем в узел сетки: при радиусе, кратном 20, на сетку
   * встаёт и габарит. Раньше круг ехал шагами сетки, навсегда сохраняя исходный сдвиг
   * относительно неё, — то есть на клетки не вставал вовсе.
   */
  snapAbsolute: boolean;
  startPos: { x: number; y: number };
  /**
   * Последняя привязанная позиция узла за жест — источник итоговой дельты.
   *
   * Читать её на `dragend` из самого узла нельзя: `dragend` всплывает снизу вверх,
   * и обработчик фигуры отрабатывает ПЕРЕД этим хуком, а круг, линия и полигон в нём
   * возвращают узел на место (их позиция в модели живёт в `x/y`, `x1..y2` и `points`,
   * а не в координатах узла). К моменту нашего обработчика `e.target.x()` у них равен
   * началу жеста, дельта выходила нулевой — и при мульти-drag остальные выделенные
   * оставались на месте, хотя визуально ехали за курсором.
   */
  lastPos: { x: number; y: number };
  /** Остальные выделенные, которые едут следом (мульти-drag). */
  others: { node: Konva.Node; orig: { x: number; y: number } }[];
}

/**
 * Перетаскивание на холсте: привязка к сетке, магнит к соседям (smart-guides) и
 * мульти-drag (тянем один выделенный элемент — остальные едут следом).
 *
 * Всё это живёт на уровне Stage, потому что drag-события Konva всплывают до него.
 * Здесь же — ЕДИНСТВЕННОЕ место, где задаётся позиция перетаскиваемого узла:
 *
 *  - раньше живой снап был только у части фигур (виджеты снапили в своём
 *    `onDragMove`, а прямоугольник, текст, таблица, график и прочие — нет, и
 *    прыгали на сетку только в момент отпускания);
 *  - направляющие примагничивали узел здесь, а `onDragEnd` фигуры затем делал
 *    `snap()` к сетке и сбивал выравнивание — элемент соскакивал с направляющей,
 *    если та не легла на шаг сетки.
 *
 * Теперь позицию доводит этот хук (сетка, поверх неё — направляющие), а фигуры в
 * `onDragEnd` берут её как есть.
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
  const dragSessionRef = useRef<DragSession | null>(null);

  // ---- Smart-guides: магнит к рёбрам/центрам соседей при перетаскивании ----
  const guideSessionRef = useRef<{
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
    dragSessionRef.current = null;
    guideSessionRef.current = null;

    const key = resolveDragKey(e.target);
    const stage = stageRef.current;
    if (!key || !stage) return;

    const startPos = e.target.position();
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
            startPos,
            startBounds: b,
            candidates: collectGuideCandidates(elements, candidateEls),
          };
        }
      }
    }

    // Мульти-drag — только когда тянем один из ≥2 выделенных.
    let others: DragSession["others"] = [];
    if (selectedIds.length >= 2 && selectedIds.includes(key)) {
      // Двигаем только верхнеуровневые выделенные — элемент с выделенным предком едет с ним.
      const hasSelectedAncestor = (k: string): boolean => {
        let pk = elementsMap[k]?.parentKey;
        while (pk) {
          if (selectedSet.has(pk)) return true;
          pk = elementsMap[pk]?.parentKey ?? null;
        }
        return false;
      };

      // Один обход дерева вместо stage.findOne() на каждый выделенный элемент.
      const nodeByKey = collectNodesById(stage);

      others = selectedIds
        .filter(k => k !== key && !hasSelectedAncestor(k))
        .map(k => nodeByKey.get(k))
        .filter((n): n is Konva.Node => Boolean(n))
        .map(n => ({ node: n, orig: n.position() }));
    }

    dragSessionRef.current = {
      key,
      target: e.target,
      snapAbsolute: e.target.id() === key || el?.type === "circle",
      startPos,
      lastPos: startPos,
      others,
    };

    // Жест завершается ДВУМЯ коммитами в стор: сначала onDragEnd самой фигуры
    // (события Konva всплывают снизу вверх), затем moveSelectedBy для остальных.
    // Это две записи истории на один жест — Ctrl+Z возвращал часть элементов.
    // Склеиваем весь жест в один шаг (тот же приём, что у стрелок и палитры цвета).
    if (others.length) beginHistoryGroup();
  }, [selectedIds, elements, elementsMap, resolveDragKey, stageRef, clearHover]);

  const handleStageDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const session = dragSessionRef.current;
    // Ручки ресайза ведут себя сами (и гасят всплытие dragstart) — их не трогаем.
    if (!session || e.target !== session.target) return;

    // 1) Привязка к сетке. Позицию — у корневых узлов и у круга (там это центр),
    //    смещение от начала жеста — у линии и полигона (там это сдвиг внутри элемента).
    const raw = e.target.position();
    let x: number;
    let y: number;
    if (session.snapAbsolute) {
      x = snap(raw.x);
      y = snap(raw.y);
    } else {
      x = session.startPos.x + snap(raw.x - session.startPos.x);
      y = session.startPos.y + snap(raw.y - session.startPos.y);
    }

    // 2) Направляющие ПОВЕРХ сетки: попал в порог — выравнивание по соседу
    //    побеждает и доживает до отпускания (фигуры больше не снапят повторно).
    let guideV: number | null = null;
    let guideH: number | null = null;
    const gs = guideSessionRef.current;
    if (gs) {
      const dx = x - gs.startPos.x;
      const dy = y - gs.startPos.y;
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
      if (mv) { x += mv.offset; guideV = mv.line; }
      if (mh) { y += mh.offset; guideH = mh.line; }
    }

    e.target.position({ x, y });
    session.lastPos = { x, y };
    setGuides(prev => (prev.v === guideV && prev.h === guideH) ? prev : { v: guideV, h: guideH });

    // 3) Мульти-drag: остальные выделенные следуют за итоговой позицией. Раньше
    //    они ехали за сырой (не привязанной) позицией, а в коммит уходила
    //    привязанная дельта — на отпускании вся пачка дёргалась.
    const dx = x - session.startPos.x;
    const dy = y - session.startPos.y;
    for (const { node, orig } of session.others) {
      node.position({ x: orig.x + dx, y: orig.y + dy });
    }
  }, [zoom]);

  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const session = dragSessionRef.current;
    if (!session || e.target !== session.target) return;

    dragSessionRef.current = null;
    guideSessionRef.current = null;
    setGuides(prev => (prev.v === null && prev.h === null) ? prev : { v: null, h: null });

    if (!session.others.length) return;

    // Дельта уже привязана (сетка/направляющие) в handleStageDragMove — берём её
    // из сессии, а не из узла: фигура могла вернуть его на место в своём обработчике
    // (см. lastPos).
    const dx = session.lastPos.x - session.startPos.x;
    const dy = session.lastPos.y - session.startPos.y;

    // Возвращаем императивно сдвинутые узлы на исходные позиции ДО коммита:
    // у линий/кругов группа не имеет controlled x/y, и React сам не сбросил бы сдвиг.
    for (const { node, orig } of session.others) node.position(orig);

    moveSelectedBy(dx, dy, session.key);

    // Весь перенос отменяется одним Ctrl+Z.
    endHistoryGroup();
  }, [moveSelectedBy]);

  return { guides, handleStageDragStart, handleStageDragMove, handleStageDragEnd };
}

/** Все узлы сцены с непустым id, за один обход дерева. */
function collectNodesById(stage: Konva.Stage): Map<string, Konva.Node> {
  const byId = new Map<string, Konva.Node>();
  stage.find((node: Konva.Node) => {
    const id = node.id();
    if (id && !byId.has(id)) byId.set(id, node);
    return false;
  });
  return byId;
}
