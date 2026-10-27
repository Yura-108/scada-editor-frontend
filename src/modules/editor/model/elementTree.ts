/**
 * Дерево элементов схемы: классификация (группа / компонент / примитив), рамки групп,
 * потомки, сдвиг и клонирование набора. Чистые функции над массивом `elements` — стора
 * не знают. Перенесены из useEditorStore без изменений (docs/architecture.md, шаг 6);
 * правила обхода (`children` / `composition` / `parentKey`) — docs/domain/editor-model.md.
 */
import {DiagramElement, ElementType, LeafElement, SceneType} from "@/types/editorElement.type";
import {GROUP_PADDING, resolveParentAbsoluteIndexed, ElementIndex, getElementIndex, shiftElementPositions, isBoundsContributor, elementBoundsRendered} from "@/core/scene";
import {
  detachServerBindingIds,
  detachServerEventIds,
  detachServerScriptIds,
  detachServerStateIds,
} from "./detachServerIds";
import {elementRegistry} from "@/constants/propertiesPanel";
import {createUuid} from "@/shared/lib/createUuid";

export const isGroup = (el: DiagramElement) => el.type === "group";

/**
 * Верхнеуровневые выделенные: без выделенного предка (элемент с выделенным
 * предком едет вместе с ним, отдельный сдвиг задвоил бы перемещение).
 */
export const topLevelSelectedKeys = (selectedIds: string[], elements: DiagramElement[]): string[] => {
  const {byKey} = getElementIndex(elements);
  const selectedSet = new Set(selectedIds);
  const hasSelectedAncestor = (el: DiagramElement): boolean => {
    let pk = el.parentKey;
    while (pk) {
      if (selectedSet.has(pk)) return true;
      pk = byKey[pk]?.parentKey ?? null;
    }
    return false;
  };
  return selectedIds.filter(k => {
    const el = byKey[k];
    return !!el && !hasSelectedAncestor(el);
  });
};

/** Применяет индивидуальные сдвиги к элементам и пересчитывает рамки их предков. */
export const applyShifts = (
  elements: DiagramElement[],
  shifts: Map<string, {dx: number; dy: number}>,
  sceneId: number | null | undefined,
): DiagramElement[] => {
  const next = elements.map(el => {
    const s = shifts.get(el.key);
    return s && (s.dx || s.dy) ? shiftElementPositions(el, s.dx, s.dy) : el;
  });
  // Один пересчёт на весь набор: раньше здесь был цикл с полным проходом по
  // массиву на каждый сдвинутый ключ.
  return recomputeAncestorBounds(next, shifts.keys(), sceneId);
};

/**
 * Клонирует набор элементов (с потомками) с ремапом ключей и смещением корней
 * вправо-вниз. Корни клона реparent'ятся в корень сцены. Общая база для
 * вставки (Ctrl+V) и дублирования (Ctrl+D).
 */
export const cloneElementsWithOffset = (
  source: DiagramElement[],
  scene: SceneType | null,
  /** Смещение корней. Вектор, а не одно число: вставка «под курсор» двигает набор
   *  по X и Y на разную величину. */
  offset: {dx: number; dy: number} = {dx: 60, dy: 60},
): {newElements: DiagramElement[]; newRootKeys: string[]} => {
  // Новые уникальные ключи для каждого элемента набора
  const keyMap: Record<string, string> = {};
  source.forEach(el => { keyMap[el.key] = createUuid(); });

  // "Корневые" элементы — те, чей родитель не входит в набор
  const sourceKeys = new Set(source.map(el => el.key));

  const newElements = source.map(el => {
    const isRoot = !sourceKeys.has(el.parentKey ?? '');
    const remapped = {
      ...el,
      id: null,
      key: keyMap[el.key],
      parentKey: isRoot
        ? String(scene?.id ?? '')
        : (keyMap[el.parentKey!] ?? el.parentKey),
      parentId: isRoot ? (scene?.id ?? null) : null,
      children: (el.children ?? []).map(childKey => keyMap[childKey] ?? childKey),
      composition: (el.composition ?? []).map(k => keyMap[k] ?? k),
      // Скриптам выдаём новые локальные uuid (они же React-ключи), чтобы копия
      // не делила идентификаторы с оригиналом; серверные id снимаются со всех
      // вложенных сущностей — см. detachServer*Ids.
      // ЗАМЕЧАНИЕ: `properties` копируются вместе с серверными id — у
      // PropertyCreateDto поле id обязательное (number), обнуление требует
      // правки контракта свойств и сюда не входит.
      scripts: detachServerScriptIds(el.scripts),
      bindings: detachServerBindingIds(el.bindings),
      ...(el.events ? {events: detachServerEventIds(el.events)} : {}),
      states: detachServerStateIds(el.states),
    } as DiagramElement;

    // Смещаем только корневые (дочерние двигаются вместе с родителем);
    // сдвигаются все позиционные поля — см. shiftElementPositions.
    if (!isRoot) return remapped;

    return shiftElementPositions(remapped, offset.dx, offset.dy);
  });

  const newRootKeys = newElements
    .filter(el => el.parentKey === String(scene?.id ?? ''))
    .map(el => el.key);

  return {newElements, newRootKeys};
};

export const isComplex = (el: DiagramElement) =>
  elementRegistry[el.type as ElementType]?.complex ?? false;

/** Логический компонент: промоутнутая группа или сложный элемент (button/custom). Участвует в children. */
export const isComponentEl = (el: DiagramElement) => el.isComponent === true || isComplex(el);

/** Листовой примитив-рисунок (line/circle/rect/polygon/text/...). При промоуте уходит в composition. */
export const isLeafPrimitive = (el: DiagramElement) => !isComplex(el) && el.type !== "group";

/**
 * `layoutGroupFromBounds` кладёт ВСЕ переданные ключи в `children`. Эта функция
 * переразбивает состав контейнера по роли: примитивы → composition, компоненты → children.
 */
export const resplitContainer = (
  elements: DiagramElement[],
  containerKey: string,
  memberKeys: string[],
): DiagramElement[] => {
  const {byKey} = getElementIndex(elements);
  const children: string[] = [];
  const composition: string[] = [];
  for (const k of memberKeys) {
    const m = byKey[k];
    if (!m) continue;
    if (isLeafPrimitive(m)) composition.push(k);
    else children.push(k);
  }
  return elements.map(el =>
    el.key === containerKey ? ({...el, children, composition} as DiagramElement) : el,
  );
};

/**
 * После перемещения/ресайза элемента пересчитывает x/y/w/h всех групп-предков
 * снизу вверх, чтобы рамки групп всегда облегали своё содержимое.
 * Компенсирует сдвиг origin группы в локальных координатах детей, чтобы не
 * было визуального прыжка при расширении рамки в сторону верхнего-левого угла.
 *
 * Отступ здесь ОДИН и тот же, что при создании группы (`GROUP_PADDING`, сейчас 0 —
 * рамка по контуру членов). Раньше пересчёт добавлял сверху ещё 20
 * (`RECOMPUTE_EXTRA_PADDING`): группа создавалась с одним полем, а после первого же
 * сдвига ребёнка рамка навсегда прыгала на 20 наружу с каждой стороны. Компенсация
 * сдвига origin, которую обещал тот отступ, на самом деле сделана отдельно и честно —
 * циклом встречного сдвига детей ниже.
 */

/**
 * Пересчитывает рамки групп-предков после перемещения элементов.
 *
 * Принимает СРАЗУ ВЕСЬ набор сдвинутых ключей. Раньше функция вызывалась по
 * одному разу на каждый ключ, и каждый вызов проходил `.map()` по всему массиву
 * на каждого предка в цепочке плюс пересобирал индекс — перенос 50 выделенных
 * элементов означал 50 полных проходов. Теперь цепочки предков объединяются,
 * обходятся снизу вверх ровно один раз, а рабочая копия массива правится по
 * индексу: трогаются только сама группа и её прямые дети.
 */
export const recomputeAncestorBounds = (
  elements: DiagramElement[],
  movedKeys: Iterable<string>,
  sceneId: number | null | undefined,
): DiagramElement[] => {
  const sceneIdStr = String(sceneId ?? "");
  const totalPadding = GROUP_PADDING;

  const index = getElementIndex(elements);

  // Группы-предки всех сдвинутых элементов с глубиной вложенности: пересчитывать
  // нужно снизу вверх, иначе внешняя группа считалась бы по устаревшим детям.
  const depthByGroupKey = new Map<string, number>();
  for (const movedKey of movedKeys) {
    const chain: string[] = [];
    let parentKey = index.byKey[movedKey]?.parentKey ?? null;
    while (parentKey && parentKey !== sceneIdStr) {
      const parent = index.byKey[parentKey];
      if (!parent || parent.type !== "group") break;
      chain.push(parent.key);
      parentKey = parent.parentKey ?? null;
    }
    // chain[0] — ближайший предок; глубина = длина цепочки от него вверх.
    for (let i = 0; i < chain.length; i++) {
      const depth = chain.length - i;
      const known = depthByGroupKey.get(chain[i]);
      if (known === undefined || depth > known) depthByGroupKey.set(chain[i], depth);
    }
  }

  if (!depthByGroupKey.size) return elements;

  const orderedGroupKeys = [...depthByGroupKey.keys()]
    .sort((a, b) => depthByGroupKey.get(b)! - depthByGroupKey.get(a)!);

  // Рабочая копия: правки вносим по индексу, а не пересборкой всего массива.
  const work = elements.slice();
  const posByKey = new Map<string, number>();
  work.forEach((el, i) => posByKey.set(el.key, i));

  // Индекс над рабочей копией: `childKeysOf` не меняется (parentKey не трогаем),
  // а `byKey` обновляем при каждой замене элемента.
  const workIndex: ElementIndex = {
    byKey: {...index.byKey},
    byId: index.byId,
    childKeysOf: index.childKeysOf,
  };

  const replace = (el: DiagramElement) => {
    const pos = posByKey.get(el.key);
    if (pos === undefined) return;
    work[pos] = el;
    workIndex.byKey[el.key] = el;
  };

  let changed = false;

  for (const groupKey of orderedGroupKeys) {
    const group = workIndex.byKey[groupKey];
    if (!group || group.type !== "group") continue;

    const childKeys = [...group.children, ...(group.composition ?? [])];
    if (!childKeys.length) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const childKey of childKeys) {
      const child = workIndex.byKey[childKey];
      if (!child) continue;
      // Рамка облегает то, что ВИДНО. Скрытый элемент рендер пропускает
      // (`CanvasNode`), но `getElementBounds` про `visible` не знает вовсе — так
      // служебный элемент импорта CONTUR (`contur_meta`, visible: false, габарит 0)
      // молча растягивал рамку до начала координат.
      if (!isBoundsContributor(child, workIndex)) continue;
      const b = elementBoundsRendered(child, workIndex);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    // Ни одного видимого члена — облегать нечего, рамку оставляем как есть.
    if (!isFinite(minX)) continue;

    const parentAbs = resolveParentAbsoluteIndexed(group.parentKey, workIndex, sceneId);

    const newGroupX = minX - totalPadding - parentAbs.x;
    const newGroupY = minY - totalPadding - parentAbs.y;
    const newGroupW = maxX - minX + totalPadding * 2;
    const newGroupH = maxY - minY + totalPadding * 2;
    const dx = newGroupX - group.x;
    const dy = newGroupY - group.y;

    if (dx === 0 && dy === 0 && group.w === newGroupW && group.h === newGroupH) continue;
    changed = true;

    replace({
      ...group,
      x: newGroupX,
      y: newGroupY,
      w: newGroupW,
      h: newGroupH,
    } as DiagramElement);

    if (dx === 0 && dy === 0) continue;

    // Компенсируем сдвиг origin группы в локальных координатах прямых детей,
    // чтобы их абсолютная позиция на холсте не изменилась.
    for (const childKey of childKeys) {
      const el = workIndex.byKey[childKey];
      if (!el) continue;

      const leafEl = el as LeafElement;
      const adjustedStates = (el.states ?? []).map(s => ({
        ...s,
        overrides: Object.fromEntries(
          Object.entries(s.overrides ?? {}).map(([k, v]) => {
            if (typeof v !== "number") return [k, v];
            if (k === "x" || k === "x1" || k === "x2") return [k, v - dx];
            if (k === "y" || k === "y1" || k === "y2") return [k, v - dy];
            return [k, v];
          }),
        ),
      }));

      replace({
        ...el,
        x: el.x - dx,
        y: el.y - dy,
        ...(leafEl.x1 !== undefined ? {x1: leafEl.x1 - dx} : {}),
        ...(leafEl.y1 !== undefined ? {y1: leafEl.y1 - dy} : {}),
        ...(leafEl.x2 !== undefined ? {x2: leafEl.x2 - dx} : {}),
        ...(leafEl.y2 !== undefined ? {y2: leafEl.y2 - dy} : {}),
        states: adjustedStates,
      } as DiagramElement);
    }
  }

  return changed ? work : elements;
};

export const getDescendantKeys = (rootKey: string, elements: DiagramElement[]) => {
  const result = new Set<string>();
  const queue = [rootKey];
  const {byKey} = getElementIndex(elements);

  while (queue.length) {
    const currentKey = queue.shift()!;
    const current = byKey[currentKey];

    if (!current) continue;

    for (const childKey of [...(current.children ?? []), ...(current.composition ?? [])]) {
      if (result.has(childKey)) continue;

      result.add(childKey);
      queue.push(childKey);
    }
  }

  result.delete(rootKey);
  return [...result];
};
