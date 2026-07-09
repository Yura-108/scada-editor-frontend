import { DiagramElement } from "@/types/editorElement.type";

/**
 * По ключу кликнутого элемента определяет, что реально должно выделиться.
 * - Верхний уровень: возвращает корневого предка (прямого ребёнка сцены).
 * - Внутри группы (activeGroupKey): прямого ребёнка активной группы,
 *   либо null, если клик пришёлся вне активной группы.
 */
export function resolveClickTarget(
  clickedKey: string,
  elementsMap: Record<string, DiagramElement>,
  activeGroupKey: string | null,
  sceneId: string,
): string | null {
  if (!activeGroupKey) {
    let key: string | null = clickedKey;
    let prev = key;
    while (key) {
      const el = elementsMap[key];
      if (!el) break;
      if (el.parentKey === sceneId) return key;
      prev = key;
      key = el.parentKey;
    }
    return prev;
  }

  let key: string | null = clickedKey;
  while (key) {
    const el = elementsMap[key];
    if (!el) return null;
    if (el.parentKey === activeGroupKey) return key;
    key = el.parentKey;
  }
  return null;
}
