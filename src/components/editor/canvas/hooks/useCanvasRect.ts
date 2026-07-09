import { RefObject, useEffect } from "react";

/** Публикует bounding-rect контейнера холста в стор и обновляет его при resize окна. */
export function useCanvasRect(
  containerRef: RefObject<HTMLDivElement | null>,
  setCanvasRect: (rect: DOMRect) => void,
) {
  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setCanvasRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [containerRef, setCanvasRect]);
}
