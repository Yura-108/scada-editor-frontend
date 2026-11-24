import React, {useState, type RefObject} from "react";
import {panelLimits, type PanelSide} from "../lib/workspaceLayout";
import type {WorkspaceLayout} from "./usePersistedLayout";

/** Изменение ширины боковых панелей: перетаскиванием края и с клавиатуры. */
export function usePanelResize(rootRef: RefObject<HTMLDivElement | null>, layout: WorkspaceLayout) {
  const {leftWidth, rightWidth, setLeftWidth, setRightWidth, setLeftVisible, setRightVisible} = layout;
  const [resizingSide, setResizingSide] = useState<PanelSide | null>(null);

  /**
   * Перетаскивание края панели: ширина следует за курсором, а при уходе ниже
   * порога панель схлопывается (тот же жест, что и «Свернуть», плюс сброс к
   * дефолтной ширине).
   *
   * Во время жеста ширина живёт в CSS-переменных корневого узла, и React в нём
   * не участвует. Раньше каждый `pointermove` вызывал `setState` — то есть сотни
   * ре-рендеров всего редактора (палитра, слои, свойства, тулбар и холст) на
   * один жест. В стор состояние уходит один раз, на отпускании.
   */
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, side: PanelSide) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    setResizingSide(side);

    const {collapseAt, max: maxWidth, defaultWidth} = panelLimits(side);

    // Итог жеста: применяется к CSS-переменным на каждое движение и один раз
    // уходит в состояние React на отпускании.
    let width = startWidth;
    let visible = true;

    const paint = () => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty(`--ws-${side}-w`, `${width}px`);
      root.style.setProperty(`--ws-${side}-m`, visible ? `${width}px` : "0px");
    };

    const onMove = (ev: PointerEvent) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const raw = startWidth + delta;
      if (raw < collapseAt) {
        visible = false;
        width = defaultWidth;
      } else {
        visible = true;
        width = Math.min(raw, maxWidth);
      }
      paint();
    };

    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      // pointercancel: система может отобрать указатель (жест браузера, отключение
      // устройства). Без этого обработчика панель залипала в режиме перетаскивания.
      handle.removeEventListener("pointercancel", onUp);
      setResizingSide(null);
      if (side === "left") {
        setLeftWidth(width);
        setLeftVisible(visible);
      } else {
        setRightWidth(width);
        setRightVisible(visible);
      }
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  /** Изменение ширины панели с клавиатуры (ручка — role="separator"). */
  const handleResizeKey = (e: React.KeyboardEvent, side: PanelSide) => {
    const STEP = 16;
    const width = side === "left" ? leftWidth : rightWidth;
    const {collapseAt: min, max, defaultWidth} = panelLimits(side);
    const setWidth = side === "left" ? setLeftWidth : setRightWidth;
    const setVisible = side === "left" ? setLeftVisible : setRightVisible;

    // Для левой панели «шире» — это вправо, для правой — влево.
    const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";

    let next: number | null = null;
    if (e.key === grow) next = Math.min(width + STEP, max);
    else if (e.key === shrink) next = width - STEP;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setVisible(false);
      return;
    }

    if (next === null) return;
    e.preventDefault();
    if (next < min) {
      setVisible(false);
      setWidth(defaultWidth);
    } else {
      setWidth(next);
    }
  };

  return {resizingSide, handleResizeStart, handleResizeKey};
}
