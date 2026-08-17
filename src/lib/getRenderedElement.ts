import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";

type Overrides = Record<string, unknown>;

interface RenderedCacheEntry {
  stateId: string | undefined;
  runtime: Overrides | undefined;
  result: DiagramElement;
}

/**
 * Кэш результата по идентичности элемента.
 *
 * Элементы неизменяемы: любая правка создаёт новый объект. Значит при том же
 * объекте, том же активном состоянии и той же ссылке на рантайм-оверрайды
 * результат не может отличаться. Это самая горячая функция холста (рендер каждой
 * фигуры, каждый расчёт границ, каждый кандидат направляющих), и раньше она на
 * каждый вызов делала два `states.find` и создавала новый объект — а новый
 * объект ещё и ломал сравнение ссылок в React.memo.
 */
const renderedCache = new WeakMap<DiagramElement, RenderedCacheEntry>();

/**
 * Фактически отображаемый вид элемента при явно заданном состоянии: базовые поля
 * + overrides активного состояния + рантайм-оверрайды монитора (последние сверху).
 *
 * Этот вариант вызывают там, где активное состояние уже прочитано из стора через
 * подписку React — тогда компонент перерисуется при его смене.
 */
export function getRenderedElementWith(
  el: DiagramElement,
  stateId: string | undefined,
  runtimeOverrides: Overrides | undefined,
): DiagramElement {
  const activeStateId = stateId
    ?? el.states.find(s => s.isDefault)?.id
    ?? el.states[0]?.id;

  const cached = renderedCache.get(el);
  if (cached && cached.stateId === activeStateId && cached.runtime === runtimeOverrides) {
    return cached.result;
  }

  const state = activeStateId
    ? el.states.find(s => s.id === activeStateId)
    : undefined;

  // Накладывать нечего — отдаём сам элемент. Пустые overrides у состояния
  // встречаются сплошь и рядом (свежесозданный элемент, группа), а лишний spread
  // давал бы новый объект на каждый вызов и ломал сравнение ссылок в React.memo.
  const stateOverrides = state?.overrides;
  const hasStateOverrides = !!stateOverrides && Object.keys(stateOverrides).length > 0;
  const hasRuntimeOverrides = !!runtimeOverrides && Object.keys(runtimeOverrides).length > 0;

  const result = (!hasStateOverrides && !hasRuntimeOverrides)
    ? el
    : {
      ...el,
      ...(stateOverrides ?? {}),
      ...(runtimeOverrides ?? {}),
    };

  renderedCache.set(el, {stateId: activeStateId, runtime: runtimeOverrides, result});
  return result;
}

/**
 * То же самое, но активное состояние берётся из стора нереактивно.
 * Годится для расчётов вне рендера (геометрия, сериализация, направляющие).
 */
export function getRenderedElement(el: DiagramElement): DiagramElement {
  const {currentComponentStateByElementKey, runtimeOverridesByElementKey} = useEditorStore.getState();
  return getRenderedElementWith(
    el,
    currentComponentStateByElementKey[el.key],
    runtimeOverridesByElementKey[el.key],
  );
}
