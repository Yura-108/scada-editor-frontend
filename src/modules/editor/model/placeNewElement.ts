import {DiagramElement} from "@/types/editorElement.type";
import {getElementIndex, shiftElementPositions, getAbsoluteRenderedPos} from "@/core/scene";
import {isComponentEl, isGroup, isLeafPrimitive, recomputeAncestorBounds} from "./elementTree";
import {syncMemberStates} from "./elementStates";

/**
 * Кладёт готовый элемент в схему — в открытый контейнер, если пользователь в него
 * вошёл, иначе в корень сцены. Возвращает новый массив `elements`.
 *
 * Раньше все ветки писали `parentKey: scene.id` намертво, и добавить примитив в
 * компонент было нельзя вообще: приходилось класть его рядом и потом «Переместить
 * в группу». Элемент строится в МИРОВЫХ координатах, поэтому внутрь контейнера он
 * переезжает сдвигом на его абсолютную позицию (`shiftElementPositions` двигает и
 * `x/y`, и концы линии, и overrides всех состояний).
 */
export function placeNewElement(
  elements: DiagramElement[],
  element: DiagramElement,
  activeGroupKey: string | null,
  sceneId: number | undefined,
): DiagramElement[] {
  const {byKey} = getElementIndex(elements);
  const host = activeGroupKey ? byKey[activeGroupKey] : undefined;

  if (!host || !isGroup(host)) return [...elements, element];

  const hostAbs = getAbsoluteRenderedPos(host, byKey);
  const local = shiftElementPositions(element, -hostAbs.x, -hostAbs.y);
  const member: DiagramElement = {
    ...local,
    parentKey: host.key,
    parentId: host.id ?? null,
  };

  // Роль в контейнере — та же, что у resplitContainer: примитивы компонента
  // живут в composition, компоненты — в children.
  const toComposition = isLeafPrimitive(member) && isComponentEl(host);

  let next = [
    ...elements.map(el => el.key !== host.key ? el : ({
      ...el,
      children: toComposition ? el.children : [...el.children, member.key],
      composition: toComposition
        ? [...(el.composition ?? []), member.key]
        : (el.composition ?? []),
    } as DiagramElement)),
    member,
  ];
  // Новый член сразу получает весь набор состояний контейнера.
  next = syncMemberStates(next, host.key, [member.key]);
  // Рамка контейнера обязана вырасти под новый элемент.
  return recomputeAncestorBounds(next, [member.key], sceneId);
}
