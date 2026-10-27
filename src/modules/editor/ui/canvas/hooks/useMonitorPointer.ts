import { useCallback, type RefObject } from "react";
import type Konva from "konva";
import {getElementIndex, readMonitorMenu} from "@/core/scene";
import { isMonitorContainer, pickMonitorContainer, pickMonitorTarget } from "../../../lib/pickMonitorTarget";
import { isRuntimeLive, type ScreenPoint } from "@/lib/runtime/runtimeEventBus";
import { buildMonitorMenu, hasMonitorMenu, isOpenableTrend } from "../lib/buildMonitorMenu";
import type { DiagramElement } from "@/types/editorElement.type";
import { useEditorStore } from "../../../model/editorStore";
import type { CanvasMenuState } from "../types";

interface UseMonitorPointerArgs {
  stageRef: RefObject<Konva.Stage | null>;
  /** Режим «Архив» — через ref, чтобы обработчики не пересоздавались на его смену. */
  archiveRef: RefObject<boolean>;
  closeMenu: () => void;
}

/** Монитор: что под курсором — элемент, контейнер для входа и меню компонента. */
export function useMonitorPointer({ stageRef, archiveRef, closeMenu }: UseMonitorPointerArgs) {
  /**
   * Что под курсором в мониторе. Свой хит-тест, а не Konva: в readOnly основной слой
   * идёт с listening=false, фигуры вне хит-графа и e.target всегда сам Stage.
   * getRelativePointerPosition учитывает трансформ камеры — это уже мировые координаты.
   */
  const pickMonitorAtPointer = useCallback((): DiagramElement | null => {
    const pos = stageRef.current?.getRelativePointerPosition();
    if (!pos) return null;
    const s = useEditorStore.getState();
    return pickMonitorTarget(pos, {
      elementIndex: getElementIndex(s.elements),
      activeGroupKey: s.activeGroupKey,
      sceneId: String(s.scene?.id ?? ""),
    });
  }, [stageRef]);

  /**
   * Монитор: меню компонента — от того элемента, ПО КОТОРОМУ щёлкнули.
   *
   * Хит-тест отдаёт самый глубокий элемент под курсором, а теги и действия в схемах обычно
   * висят на компоненте, тогда как его внутренние примитивы пусты. Поэтому от найденного
   * поднимаемся по `parentKey` до ближайшего предка, у которого пункты есть: «точечно»
   * сохраняется (сначала пробуем именно кликнутый), но клик не проваливается в пустоту.
   *
   * Ничего не нашли по всей цепочке — null, меню не открываем вовсе.
   */
  const resolveMonitorMenu = (point?: ScreenPoint): Omit<CanvasMenuState, "x" | "y"> | null => {
    const picked = pickMonitorAtPointer();
    if (!picked) return null;

    const byKey = useEditorStore.getState().elements;
    const map = new Map(byKey.map(el => [el.key, el] as const));

    let el: DiagramElement | undefined = picked;
    const hasMenu = archiveRef.current ? isOpenableTrend : hasMonitorMenu;
    while (el && !hasMenu(el)) {
      el = el.parentKey ? map.get(el.parentKey) : undefined;
    }
    if (!el) return null;

    const items = buildMonitorMenu(el, { closeMenu, isLive: isRuntimeLive(), archive: archiveRef.current, point });
    if (!items.length) return null;

    // Вид меню задаётся тому компоненту, чьё это меню (см. подъём по parentKey выше).
    return { items, settings: readMonitorMenu(el.monitorMenu) };
  };

  /**
   * Контейнер под курсором, в который двойной клик мог бы войти. Нужен КОНТЕЙНЕР, а не
   * самый глубокий элемент: тот, как правило, лист, и заходить внутрь стало бы нечем.
   */
  const containerAtPointer = (): DiagramElement | null => {
    const pos = stageRef.current?.getRelativePointerPosition();
    if (!pos) return null;
    const s = useEditorStore.getState();
    const el = pickMonitorContainer(pos, {
      elementIndex: getElementIndex(s.elements),
      activeGroupKey: s.activeGroupKey,
      sceneId: String(s.scene?.id ?? ""),
    });
    return el && isMonitorContainer(el) ? el : null;
  };

  return { resolveMonitorMenu, containerAtPointer };
}
