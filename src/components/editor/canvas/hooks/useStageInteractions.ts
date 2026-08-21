import { RefObject, useEffect, useRef, useState } from "react";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { useEditorStore } from "@/store/useEditorStore";
import { setCanvasPointerWorld } from "@/lib/editor/canvasPointer";
import { DiagramElement } from "@/types/editorElement.type";
import isIntersecting from "@/lib/isIntersecting";
import { getSelectionBounds } from "@/lib/editor/getSelectionBounds";
import type { SelectionRect } from "../types";

/** Тот же клэмп зума, что и в ZoomControls. */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;

/**
 * Приводит колесо к пикселям. `deltaMode` бывает LINE (Firefox) и PAGE, и без
 * нормализации один и тот же жест даёт в разных браузерах разницу в ~30 раз.
 */
const normalizeWheelDelta = (e: WheelEvent): {deltaX: number; deltaY: number} => {
  const LINE_HEIGHT = 16;
  const factor =
    e.deltaMode === 1 /* DOM_DELTA_LINE */ ? LINE_HEIGHT
    : e.deltaMode === 2 /* DOM_DELTA_PAGE */ ? window.innerHeight
    : 1;
  return {deltaX: e.deltaX * factor, deltaY: e.deltaY * factor};
};

interface StageInteractionsDeps {
  stageRef: RefObject<Konva.Stage | null>;
  camera: { x: number; y: number; zoom: number };
  setCameraPan: (dx: number, dy: number) => void;
  setCameraZoom: (zoom: number) => void;
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
  selectedIds: string[];
  selectMultiple: (ids: string[]) => void;
  activeGroupKey: string | null;
  exitGroup: () => void;
  closeMenu: () => void;
  /** Что реально должно выделиться по клику в этот элемент (группа/её ребёнок). */
  resolveClickTarget: (key: string) => string | null;
  /** Режим монитора: без маркиза и сброса выделения; пан/зум остаются. */
  readOnly?: boolean;
}

/**
 * Инкапсулирует взаимодействия со Stage: зум по Ctrl+колесо, панорамирование
 * (Shift+колесо / просто колесо / средняя кнопка мыши) и рамку выделения.
 */
export function useStageInteractions({
  stageRef,
  camera,
  setCameraPan,
  setCameraZoom,
  elements,
  elementsMap,
  selectedIds,
  selectMultiple,
  activeGroupKey,
  exitGroup,
  closeMenu,
  resolveClickTarget,
  readOnly = false,
}: StageInteractionsDeps) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const middlePanRef = useRef<{ x: number; y: number } | null>(null);
  /** Рамка запущена с Shift/Ctrl — добавляем к выделению, а не заменяем его. */
  const marqueeAdditiveRef = useRef(false);

  // Панорамирование средней кнопкой — нативные window-события, чтобы drag
  // работал и за пределами холста.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!middlePanRef.current) return;
      const dx = e.clientX - middlePanRef.current.x;
      const dy = e.clientY - middlePanRef.current.y;
      middlePanRef.current = { x: e.clientX, y: e.clientY };
      useEditorStore.getState().setCameraPan(dx, dy);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && middlePanRef.current) {
        middlePanRef.current = null;
        const container = stageRef.current?.container();
        resetCanvasCursor(container);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [stageRef]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    // Firefox отдаёт deltaMode=DOM_DELTA_LINE (deltaY≈3), Chrome — PIXEL (≈100).
    // Без нормализации в Firefox холст пролистывался по 3px, а зум был незаметен.
    const { deltaX, deltaY } = normalizeWheelDelta(e.evt);

    if (e.evt.ctrlKey) {
      // Ctrl + Wheel → zoom to cursor point
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      // Мультипликативный шаг (как у кнопок ZoomControls): аддитивный давал
      // огромный относительный скачок на zoom 0.2 и почти нулевой на 3.0.
      const factor = Math.exp(-deltaY * 0.002);
      const newZoom = Math.min(Math.max(oldScale * factor, ZOOM_MIN), ZOOM_MAX);

      setCameraZoom(newZoom);
      setCameraPan(
        pointer.x - mousePointTo.x * newZoom - camera.x,
        pointer.y - mousePointTo.y * newZoom - camera.y,
      );
    } else if (e.evt.shiftKey) {
      setCameraPan(-deltaY, 0);
    } else {
      setCameraPan(-deltaX, -deltaY);
    }
  };

  /**
   * Нажатие по НЕвыделенной фигуре сразу её выделяет.
   *
   * Раньше выделение происходило по click, то есть уже после перетаскивания:
   * потянув невыделенный элемент, пользователь двигал его, а панель свойств
   * продолжала показывать другой. Группы вели себя иначе (их вообще нельзя было
   * потянуть, пока не выделишь) — правило было разным для разных типов.
   *
   * Уже выделенный элемент не трогаем: переключение Ctrl/Shift+кликом остаётся
   * на обработчике click, иначе снять выделение модификатором было бы нельзя.
   */
  const selectOnPress = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target.name() === "resize-handle") return;

    let node: Konva.Node | null = e.target;
    let key: string | null = null;
    for (let i = 0; i < 4 && node; i++) {
      const id = node.id();
      if (id && elementsMap[id]) { key = id; break; }
      node = node.getParent();
    }
    if (!key) return;

    const target = resolveClickTarget(key);
    if (!target) return;

    // Ctrl/Shift обрабатывает click: там переключение (добавить/убрать). Если
    // добавить элемент ещё и здесь, click тут же снял бы его обратно.
    const evt = e.evt;
    if (evt instanceof MouseEvent && (evt.shiftKey || evt.ctrlKey || evt.metaKey)) return;

    const state = useEditorStore.getState();
    if (state.selectedIds.includes(target)) return;

    state.selectMultiple([target]);
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    closeMenu();
    const clickedOnEmpty = e.target === e.target.getStage();
    const clickedOnBg = e.target.name() === "grid-bg";

    // Средняя кнопка → старт панорамирования.
    // preventDefault обязателен: иначе Chrome/Edge открывают виджет автоскролла
    // поверх жеста.
    if (e.evt instanceof MouseEvent && e.evt.button === 1) {
      e.evt.preventDefault();
      middlePanRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      const container = stageRef.current?.container();
      if (container) container.style.cursor = "grabbing";
      return;
    }

    // Вооружён инструмент палитры — не стартуем маркиз и не сбрасываем выделение;
    // постановка элемента идёт на Stage.onClick (Canvas.handleStagePlacementClick).
    if (useEditorStore.getState().pendingPlacement) return;

    // Монитор: клики по холсту ничего не выделяют и не рисуют маркиз
    // (средняя кнопка — панорамирование — обработана выше).
    if (readOnly) return;

    // Нажатие по фигуре — выделяем её (см. selectOnPress) и на этом всё:
    // маркиз стартует только с пустого места.
    if (!clickedOnEmpty && !clickedOnBg) {
      selectOnPress(e);
      return;
    }

    if (activeGroupKey) {
      exitGroup();
    } else if (!e.evt.shiftKey && !e.evt.ctrlKey) {
      selectMultiple([]);
    }

    const pos = stageRef.current?.getPointerPosition();
    if (pos && stageRef.current) {
      // Запоминаем модификатор: с ним рамка ДОБАВЛЯЕТ к выделению, без него —
      // заменяет. Раньше объединение было безусловным, и снять выделение
      // рамкой было невозможно.
      marqueeAdditiveRef.current = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      setSelectionRect({
        x: (pos.x - stageRef.current.x()) / stageRef.current.scaleX(),
        y: (pos.y - stageRef.current.y()) / stageRef.current.scaleX(),
        width: 0,
        height: 0,
      });
    }
  };

  const handleStageMouseMove = () => {
    // Позиция курсора в мировых координатах — для вставки «сюда» (Ctrl+V и пункт меню).
    // Пишем в модульную переменную, а не в стор: на каждый mousemove запись в стор
    // перерисовывала бы всю сцену (см. canvasPointer.ts).
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (stage && pointer) {
      setCanvasPointerWorld({
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleX(),
      });
    }

    if (selectionRect && stageRef.current) {
      const pos = stageRef.current.getPointerPosition();
      if (pos) {
        const rx = (pos.x - stageRef.current.x()) / stageRef.current.scaleX();
        const ry = (pos.y - stageRef.current.y()) / stageRef.current.scaleX();
        setSelectionRect(prev => prev ? { x: prev.x, y: prev.y, width: rx - prev.x, height: ry - prev.y } : null);
      }
    }
  };

  const handleStageMouseUp = () => {
    if (!selectionRect) return;

    const sx = Math.min(selectionRect.x, selectionRect.x + selectionRect.width);
    const sy = Math.min(selectionRect.y, selectionRect.y + selectionRect.height);
    const sw = Math.abs(selectionRect.width);
    const sh = Math.abs(selectionRect.height);

    // Кандидаты — только текущий скоуп (активная группа или корень сцены):
    // иначе рамка выбирала бы и группу, и её детей одновременно.
    const scopeKey = activeGroupKey ?? String(useEditorStore.getState().scene?.id ?? "");

    const selected = elements
      .filter(el => String(el.parentKey) === scopeKey)
      // Невидимое рамкой не ловим: служебный элемент импорта (`visible: false`) стоит
      // в (0, 0) с нулевым габаритом и иначе попадал бы в любое выделение от угла схемы.
      .filter(el => el.visible !== false)
      .filter(el => isIntersecting(
        { x: sx, y: sy, width: sw, height: sh },
        getSelectionBounds(el, elementsMap),
      ))
      .map(el => el.key);

    if (marqueeAdditiveRef.current) {
      selectMultiple([...new Set([...selectedIds, ...selected])]);
    } else {
      selectMultiple(selected);
    }
    setSelectionRect(null);
  };

  // Завершение рамки слушаем на window: обработчик Stage не срабатывает, если
  // кнопку отпустили за пределами холста (например, над боковой панелью), и
  // рамка «залипала» — оставалась нарисованной и росла на следующем движении.
  // Тот же приём, что и у панорамирования средней кнопкой выше.
  const finalizeMarqueeRef = useRef(handleStageMouseUp);
  useEffect(() => {
    finalizeMarqueeRef.current = handleStageMouseUp;
  });

  useEffect(() => {
    const onWindowMouseUp = () => finalizeMarqueeRef.current();
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, []);

  return { selectionRect, handleWheel, handleStageMouseDown, handleStageMouseMove, handleStageMouseUp };
}
