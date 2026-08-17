import { RefObject, useEffect } from "react";

/**
 * Публикует bounding-rect контейнера холста в стор и следит за его размером.
 *
 * Слушать `window.resize` недостаточно: ширина контейнера меняется и без ресайза
 * окна — при сворачивании боковой панели и перетаскивании её края. Stage при
 * этом оставался прежнего размера, и холст оказывался обрезан (или с белой
 * полосой) до следующего ресайза окна. Отсюда ResizeObserver.
 *
 * Запись в стор откладываем до кадра отрисовки: анимация панели (300 мс) даёт
 * поток срабатываний наблюдателя, и без склейки каждое из них было бы отдельным
 * обновлением стора.
 */
export function useCanvasRect(
  containerRef: RefObject<HTMLDivElement | null>,
  setCanvasRect: (rect: DOMRect) => void,
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frame = 0;
    let last: DOMRect | null = null;
    const publish = () => {
      frame = 0;
      const node = containerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      // Каждый getBoundingClientRect отдаёт новый DOMRect, а стор сравнивает по
      // ссылке — без этой проверки скролл писал бы в стор одно и то же значение
      // и перерисовывал холст.
      if (
        last &&
        last.x === rect.x && last.y === rect.y &&
        last.width === rect.width && last.height === rect.height
      ) return;
      last = rect;
      setCanvasRect(rect);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(publish);
    };

    publish();

    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    // Позиция контейнера на странице (нужна для screen→world) от ResizeObserver
    // не приходит: при скролле/ресайзе окна размер может не измениться.
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [containerRef, setCanvasRect]);
}
