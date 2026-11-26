import {
  buildComponentTree,
  getElementIndex,
  type ComponentCreateDto,
  type DiagramElement,
  type PropertyRef,
} from '@/core/scene';
import { detachServerEventIds, detachServerStateIds } from './detachServerIds';

function collectComponentIds(tree: ComponentCreateDto[], idsByKey: Map<string, number>) {
  for (const node of tree) {
    if (node.id != null) idsByKey.set(node.key, node.id);
    collectComponentIds(node.children, idsByKey);
  }
}

function stripRecreatedRefIds<T extends { propertyRefs?: PropertyRef[] }>(
  entry: T,
  recreatedKeys: Set<string>,
): T {
  if (!entry.propertyRefs?.some((ref) => recreatedKeys.has(ref.componentKey))) return entry;
  return {
    ...entry,
    propertyRefs: entry.propertyRefs.map((ref) => {
      if (!recreatedKeys.has(ref.componentKey)) return ref;
      const { propertyId: _propertyId, ...rest } = ref;
      return { ...rest, componentId: null } as PropertyRef;
    }),
  };
}

/** Сервер чистит удалённые поддеревья до записи. Их перемещённые узлы сохраняем как новые. */
export function buildSceneSaveComponents(
  elements: DiagramElement[],
  sceneId: number,
  saved: DiagramElement[] | null,
): ComponentCreateDto[] {
  const sceneKey = String(sceneId);
  const components = buildComponentTree(elements, sceneKey);
  if (!saved) return components;

  const idsByKey = new Map<string, number>();
  collectComponentIds(components, idsByKey);
  const retainedIds = new Set(idsByKey.values());
  const { byId, childKeysOf } = getElementIndex(saved);
  const removed = saved
    .filter((el) => el.id != null && !retainedIds.has(el.id))
    .map((el) => el.key);
  const prunedKeys = new Set<string>();
  for (const key of removed) {
    if (prunedKeys.has(key)) continue;
    prunedKeys.add(key);
    removed.push(...(childKeysOf[key] ?? []));
  }

  // Undo может вернуть узел с номером из более старой версии. Его также нужно создать заново.
  const recreatedKeys = new Set<string>();
  for (const [key, id] of idsByKey) {
    if (prunedKeys.has(key) || !byId[String(id)]) recreatedKeys.add(key);
  }
  if (!recreatedKeys.size) return components;

  const prepared = elements.map((element): DiagramElement => {
    const recreate = recreatedKeys.has(element.key);
    const bindings = (element.bindings ?? []).map((binding) => {
      const updated = stripRecreatedRefIds(binding, recreatedKeys);
      if (!recreate) return updated;
      const { serverId: _id, componentPropertyId, ...rest } = updated;
      const propertyName =
        rest.componentPropertyName ??
        element.properties?.find(
          (property) => property.id != null && property.id === componentPropertyId,
        )?.name;
      return { ...rest, componentPropertyName: propertyName };
    });
    const events = element.events?.map((event) =>
      event.handler
        ? { ...event, handler: stripRecreatedRefIds(event.handler, recreatedKeys) }
        : event,
    );
    return {
      ...element,
      parentId: recreatedKeys.has(element.parentKey ?? '') ? null : element.parentId,
      bindings,
      ...(events ? { events: recreate ? detachServerEventIds(events) : events } : {}),
      ...(recreate
        ? {
            id: null,
            scripts: element.scripts?.map(({ serverId: _id, ...script }) => script) ?? [],
            states: detachServerStateIds(element.states),
          }
        : {}),
    };
  });
  return buildComponentTree(prepared, sceneKey);
}
