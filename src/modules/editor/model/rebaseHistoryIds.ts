import type { DiagramElement } from '@/core/scene';
import { editorStore } from './editorStoreRef';

/**
 * Переносит присвоенные сервером `id` во все снимки истории undo/redo (по `key`).
 *
 * После сохранения история сцены сохраняется (см. `loadScene({keepHistory})`), поэтому
 * откатиться можно и «за» точку сейва. Снимки, снятые до сохранения, помнят новые
 * элементы с `id: null`, а бэкенд апсертит по `id` — повторное сохранение после такого
 * отката создало бы ДУБЛИ. Проставляем актуальные id, чтобы любой снимок оставался
 * безопасным для сохранения.
 */
export const rebaseHistoryIds = (current: DiagramElement[]) => {
  const idByKey = new Map(current.map((el) => [el.key, el.id]));

  const patch = (snapshot: Partial<{ elements: DiagramElement[] }>) => {
    if (!snapshot.elements) return snapshot;
    let changed = false;
    const elements = snapshot.elements.map((el) => {
      const serverId = idByKey.get(el.key);
      if (el.id == null && serverId != null) {
        changed = true;
        return { ...el, id: serverId } as DiagramElement;
      }
      return el;
    });
    // Ссылку массива меняем только при реальной правке — `equality` стора сравнивает
    // именно её, и лишние новые массивы засорили бы стек дубликатами.
    return changed ? { ...snapshot, elements } : snapshot;
  };

  const { pastStates, futureStates } = editorStore().temporal.getState();
  editorStore().temporal.setState({
    pastStates: pastStates.map(patch),
    futureStates: futureStates.map(patch),
  });
};
