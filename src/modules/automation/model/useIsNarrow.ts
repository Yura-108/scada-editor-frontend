import {useCallback, useEffect, useState} from "react";

/**
 * Уже ли элемент `limit` пикселей — следит за размером, пока элемент на странице.
 * Возвращает callback-ref: элемент может появиться позже (вкладка «Задачи» открылась не сразу).
 */
export function useIsNarrow(limit: number): [(node: HTMLElement | null) => void, boolean] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);

  // Первый замер — прямо при подключении элемента, до отрисовки: иначе на узком окне первый
  // кадр показал бы панели во всю ширину (ResizeObserver отвечает только к следующему кадру).
  const ref = useCallback((next: HTMLElement | null) => {
    setNode(next);
    if (next) setNarrow(next.clientWidth < limit);
  }, [limit]);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < limit));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, limit]);

  return [ref, narrow];
}
