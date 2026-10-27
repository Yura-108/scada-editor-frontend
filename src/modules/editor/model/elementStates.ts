/**
 * Состояния элементов и патчи их визуала: сравнение значений, что пишется в базу, а что в
 * overrides состояния, каскад состояния по имени на поддерево. Чистые функции — стора не
 * знают. Перенесены из useEditorStore без изменений (docs/architecture.md, шаг 6).
 */
import {DiagramElement} from "@/types/editorElement.type";
import {getElementIndex} from "@/core/scene";
import {createUuid} from "@/shared/lib/createUuid";
import {getDescendantKeys} from "./elementTree";

/**
 * Совпадают ли значения свойства элемента. Массивы (`points`, `dash`) сравниваем
 * поэлементно: новый массив с теми же числами — не изменение.
 */
export const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  return false;
};

/**
 * Меняет ли патч хоть что-то в целевом объекте (базовые поля элемента или
 * overrides его состояния). Нужен, чтобы холостая запись не создавала новый
 * массив `elements`: по ссылке на него завязаны и история undo (`equality`
 * zundo), и флаг «есть несохранённые изменения», и ре-рендер холста.
 */
export const isPatchEffective = (
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean => Object.entries(patch).some(([k, v]) => !isSameValue(target[k], v));

/**
 * Ключи, которые всегда живут в БАЗЕ элемента, а не в overrides состояния.
 *
 * `zIndex` — порядок слоя, свойство самого элемента, а не его вида в конкретном
 * состоянии: сортировка выполняется там, где активного состояния не видно (корни
 * в Canvas, состав контейнера в GroupNode). Держать слой в overrides значило бы
 * ещё и завязать порядок отрисовки на переключение состояний.
 *
 * `monitorMenu` — ширина, шрифт и высота пунктов контекстного меню в мониторе:
 * настройка компонента, а не его вида, и меню одинаково в любом состоянии.
 *
 * `trend` — окно, шаг и оформление перьев тренда: та же настройка элемента.
 */
export const BASE_ONLY_KEYS = new Set(["zIndex", "monitorMenu", "trend"]);

/** Делит патч на часть «в базу» и часть «в overrides состояния». */
export const splitBaseOnly = (
  patch: Record<string, unknown>,
): { base: Record<string, unknown>; state: Record<string, unknown> } => {
  const base: Record<string, unknown> = {};
  const state: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    (BASE_ONLY_KEYS.has(k) ? base : state)[k] = v;
  }
  return {base, state};
};

/**
 * Каскад активного состояния по ИМЕНИ вниз по поддереву (children + composition).
 * Пишет в переданную карту nextMap (elementKey → stateId) и возвращает её же.
 * Общая база для ручного переключения (StateSelect) и рантайм-батча монитора.
 */
export const cascadeStateByName = (
  elements: DiagramElement[],
  nextMap: Record<string, string>,
  rootKey: string,
  stateId: string,
): Record<string, string> => {
  nextMap[rootKey] = stateId;

  const root = elements.find(el => el.key === rootKey);
  if (!root) return nextMap;

  const rootStateName = root.states.find(s => s.id === stateId)?.name;
  if (!rootStateName) return nextMap;

  const {byKey} = getElementIndex(elements);
  for (const childKey of getDescendantKeys(rootKey, elements)) {
    const child = byKey[childKey];
    if (!child) continue;

    const matchedState = child.states.find(s => s.name === rootStateName);
    if (matchedState) {
      nextMap[childKey] = matchedState.id;
      continue;
    }

    const defaultState = child.states.find(s => s.isDefault) ?? child.states[0];
    nextMap[childKey] = defaultState?.id ?? stateId;
  }

  return nextMap;
};

export const ensureStateByName = (element: DiagramElement, stateName: string, forcedId?: string) => {
  if (element.states.some(state => state.name === stateName)) {
    return element;
  }

  const defaultState = element.states.find(s => s.isDefault) ?? element.states[0];
  const inheritedOverrides = defaultState ? { ...defaultState.overrides } : {};

  return {
    ...element,
    states: [
      ...element.states,
      {
        id: forcedId ?? createUuid(),
        name: stateName,
        overrides: inheritedOverrides,
        isDefault: false,
      },
    ],
  } as DiagramElement;
};

/**
 * Выдаёт членам контейнера все его состояния (сопоставление по ИМЕНИ).
 *
 * Набор состояний задаёт контейнер: имя — это то, по чему `cascadeStateByName`,
 * `buildShapeDescriptor` и бэкенд связывают родителя с потомками. Примитив, попавший в
 * компонент с четырьмя состояниями, имел ровно одно («Нормальное»): на холсте он падал
 * на своё состояние по умолчанию и выглядел правильно, но панель «Состояния» показывала
 * одно против четырёх — и это читается как «в других состояниях элемента нет».
 *
 * Обратного не делаем: контейнер состояния члена НЕ перенимает. `ensureStateByName`
 * идемпотентен, так что вызов на смешанном составе только заполняет пробелы.
 */
export const syncMemberStates = (
  elements: DiagramElement[],
  containerKey: string,
  memberKeys: Iterable<string>,
): DiagramElement[] => {
  const {byKey} = getElementIndex(elements);
  const container = byKey[containerKey];
  if (!container) return elements;

  const names = container.states.map(s => s.name);
  if (!names.length) return elements;

  // Состояния нужны и вложенным потомкам: состав компонента может быть многоуровневым.
  const keys = new Set<string>();
  for (const key of memberKeys) {
    keys.add(key);
    for (const descendant of getDescendantKeys(key, elements)) keys.add(descendant);
  }
  if (!keys.size) return elements;

  let changed = false;
  const next = elements.map(el => {
    if (!keys.has(el.key)) return el;
    let updated = el;
    for (const name of names) updated = ensureStateByName(updated, name);
    if (updated !== el) changed = true;
    return updated;
  });

  // Холостая правка не должна плодить новый массив: на его ссылке завязаны equality
  // истории undo и флаг несохранённых изменений.
  return changed ? next : elements;
};
