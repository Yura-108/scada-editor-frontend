import {ComponentState, DiagramElement} from "@/types/editorElement.type";
import {isGroup, recomputeAncestorBounds} from "./elementTree";
import {isPatchEffective, splitBaseOnly} from "./elementStates";

/** Минимальный размер элемента и группы по `w`/`h`. */
const MIN_SIZE = 20;

/**
 * Поля, влияющие на габарит: при их изменении пересчитываем рамки групп-предков.
 *
 * Кроме собственно позиционных сюда входят: параметры текста (его габарит меряет
 * `measureText`, а не `w/h` — укоротил подпись, и рамка осталась под старую длину),
 * `rotate` (меняется осевой bbox) и `visible` (скрытый элемент из рамки выпадает,
 * см. isBoundsContributor).
 */
const POSITIONAL_KEYS = new Set([
  "x", "y", "w", "h", "x1", "y1", "x2", "y2", "radius", "points",
  "text", "fontSize", "fontFamily", "bold", "autoWidth", "rotate", "visible",
]);

interface VisualPatchContext {
  /** Активное состояние элементов (`currentComponentStateByElementKey`). */
  stateByKey: Record<string, string>;
  /** Режим «править все состояния». */
  editAllStates: boolean;
  sceneId: number | undefined;
}

/**
 * Правка визуала элементов `keys`: у группы — в базу, у остальных — в overrides активного
 * состояния (или всех состояний в режиме `editAllStates`).
 *
 * Возвращает новый массив `elements` или `null`, если ни один элемент реально не
 * изменился. Без этого холостая запись (перетаскивание, вернувшееся в ту же точку;
 * повторный выбор того же цвета) создавала новый массив elements — а значит шаг undo,
 * пометку «есть несохранённые изменения» и ре-рендер всей сцены.
 */
export function applyVisualPatch(
  elements: DiagramElement[],
  keys: string[],
  updates: Partial<DiagramElement>,
  {stateByKey, editAllStates, sceneId}: VisualPatchContext,
): DiagramElement[] | null {
  const keySet = new Set(keys);
  let anyChanged = false;

  const updatedElements = elements.map(el => {
    if (!keySet.has(el.key)) return el;

    // Валидация: гарантируем минимальные размеры для групп и элементов
    const validatedUpdates = {
      ...updates,
      ...(updates.w !== undefined && { w: Math.max(MIN_SIZE, updates.w) }),
      ...(updates.h !== undefined && { h: Math.max(MIN_SIZE, updates.h) }),
    };

    // Группы всегда хранят позицию в base, не в overrides.
    // recomputeAncestorBounds читает group.x (base), поэтому override
    // приводит к расхождению rendered.x vs base.x и телепортации детей.
    if (isGroup(el)) {
      if (!isPatchEffective(el as unknown as Record<string, unknown>, validatedUpdates)) return el;
      anyChanged = true;
      return { ...el, ...validatedUpdates } as DiagramElement;
    }

    const currentComponentStateId = stateByKey[el.key]
      ?? el.states.find(s => s.isDefault)?.id
      ?? el.states[0]?.id;

    if (!currentComponentStateId) {
      if (!isPatchEffective(el as unknown as Record<string, unknown>, validatedUpdates)) return el;
      anyChanged = true;
      return {
        ...el,
        ...validatedUpdates,
      } as DiagramElement;
    }

    // Сравниваем с ФАКТИЧЕСКИМ значением (база + overrides состояния), а не
    // только с overrides: у нетронутого элемента позиция лежит в базе, и
    // сравнение с пустыми overrides считало бы любую запись изменением.
    //
    // В режиме «править все состояния» проверять одно текущее нельзя: патч,
    // совпавший с ним, но отличный от остальных, обязан примениться — иначе
    // выравнивание состояний молча не срабатывало бы.
    const effectiveOf = (st: ComponentState | undefined) => ({
      ...(el as unknown as Record<string, unknown>),
      ...(st?.overrides ?? {}),
    });
    const patchLands = editAllStates
      ? el.states.some(st => isPatchEffective(effectiveOf(st), validatedUpdates))
      : isPatchEffective(effectiveOf(el.states.find(s => s.id === currentComponentStateId)), validatedUpdates);
    if (!patchLands) return el;
    anyChanged = true;

    // Часть ключей (BASE_ONLY_KEYS, например слой zIndex) пишем в базу даже
    // у листа: они не зависят от состояния. Если состояний-специфичных
    // ключей в патче нет — states не пересобираем.
    const {base: baseUpdates, state: stateUpdates} = splitBaseOnly(validatedUpdates);

    return {
      ...el,
      ...baseUpdates,
      // editAllStates — правка ложится во ВСЕ состояния элемента: оформление,
      // одинаковое во всех состояниях, иначе пришлось бы повторять руками в каждом.
      states: Object.keys(stateUpdates).length
        ? el.states.map(s =>
          (editAllStates || s.id === currentComponentStateId)
            ? {
              ...s,
              overrides: {
                ...s.overrides,
                ...stateUpdates,
              },
            }
            : s
        )
        : el.states,
    } as DiagramElement;
  });

  if (!anyChanged) return null;

  const hasPositionalChange = Object.keys(updates).some(k => POSITIONAL_KEYS.has(k));
  if (hasPositionalChange) {
    return recomputeAncestorBounds(updatedElements, keys, sceneId);
  }

  return updatedElements;
}
