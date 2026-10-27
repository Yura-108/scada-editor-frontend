import {DiagramElement, LeafElement} from "@/types/editorElement.type";
import {isComponentEl, isLeafPrimitive} from "../elementTree";
import {syncMemberStates} from "../elementStates";
import type {GroupResult} from "./groupElements";

/**
 * «Создать компонент» из группы: группа становится компонентом, её примитивы (в том
 * числе из вложенных «глупых» групп) — его `composition`, компоненты — `children`,
 * а обычные под-группы расформировываются. `null` — это не группа.
 */
export function componentFromGroup(
  elements: DiagramElement[],
  groupKey: string,
  name: string | undefined,
): GroupResult | null {
  const group = elements.find(el => el.key === groupKey);
  if (!group || group.type !== "group") return null;

  const primitiveKeys: string[] = [];
  const componentKeys: string[] = [];
  const dissolvedGroupKeys = new Set<string>();
  // key -> накопленный сдвиг для перевода в координатное пространство компонента
  const offsetByKey = new Map<string, {dx: number; dy: number}>();
  const reparent = new Set<string>();

  // Обходим поддерево: примитивы (в т.ч. из вложенных «глупых» групп) → composition,
  // компоненты → children; обычные под-группы расформировываем, накапливая их смещение.
  const walk = (containerKey: string, dx: number, dy: number) => {
    for (const kid of elements.filter(e => e.parentKey === containerKey)) {
      if (isLeafPrimitive(kid)) {
        primitiveKeys.push(kid.key);
        offsetByKey.set(kid.key, {dx, dy});
        reparent.add(kid.key);
      } else if (isComponentEl(kid)) {
        componentKeys.push(kid.key);
        offsetByKey.set(kid.key, {dx, dy});
        reparent.add(kid.key);
      } else {
        // обычная под-группа: узел исчезает, дети поднимаются в компонент
        dissolvedGroupKeys.add(kid.key);
        walk(kid.key, dx + kid.x, dy + kid.y);
      }
    }
  };
  walk(groupKey, 0, 0);

  const shift = (el: DiagramElement): DiagramElement => {
    const off = offsetByKey.get(el.key) ?? {dx: 0, dy: 0};
    const leaf = el as LeafElement;
    return {
      ...el,
      parentKey: groupKey,
      parentId: group.id,
      x: el.x + off.dx,
      y: el.y + off.dy,
      ...(leaf.x1 !== undefined ? {x1: leaf.x1 + off.dx} : {}),
      ...(leaf.y1 !== undefined ? {y1: leaf.y1 + off.dy} : {}),
      ...(leaf.x2 !== undefined ? {x2: leaf.x2 + off.dx} : {}),
      ...(leaf.y2 !== undefined ? {y2: leaf.y2 + off.dy} : {}),
    } as DiagramElement;
  };

  const updated = elements
    .filter(el => !dissolvedGroupKeys.has(el.key))
    .map(el => {
      if (el.key === groupKey) {
        return {
          ...el,
          isComponent: true,
          composition: primitiveKeys,
          children: componentKeys,
          label: name ?? el.label ?? "Компонент",
        } as DiagramElement;
      }
      if (reparent.has(el.key)) return shift(el);
      return el;
    });

  // Примитивы, ставшие составом компонента, получают его состояния.
  return {
    elements: syncMemberStates(updated, groupKey, [...primitiveKeys, ...componentKeys]),
    selectedIds: [groupKey],
  };
}
