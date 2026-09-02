import {ComponentCreateDto, DiagramElement} from "@/types/editorElement.type";
import {BindingDto} from "@/types/binding.types";

/**
 * id свойства элемента для DTO-поля `component_property_id` (контракт требует
 * число, ссылающееся на существующее свойство ИМЕННО этого компонента).
 * Предпочитаем свойство-тег (исторически), но для биндингов на свойства других
 * компонентов у хоста тег-свойства может не быть — тогда годится любое сохранённое.
 *
 * `undefined` — сохранённых свойств у элемента нет вовсе. Раньше здесь возвращался `0`,
 * но нулевого свойства не существует, и бэкенд такой биндинг отвергает. Поле честнее
 * опустить: «не задано» — это задокументированное «биндинг новый» (см.
 * TagBinding.componentPropertyId), а привязку бэкенд сделает по
 * `component_property_name`. Так бывает у свойства, заводимого в этом же запросе.
 */
const firstSavedPropertyId = (el: DiagramElement): number | undefined => {
  const props = el.properties ?? [];
  const tagProp = props.find(p => p.property_type === "Тег" && typeof p.id === "number");
  if (tagProp) return tagProp.id;
  return props.find(p => typeof p.id === "number")?.id;
};

/**
 * Имя свойства, к которому привязан биндинг, — для шаблона.
 *
 * У DTO шаблона нет `id` ни на одном уровне, сущности связываются по именам
 * (§2 контракта версий), поэтому номер свойства в шаблон не годится, а имя годится.
 */
const firstSavedPropertyName = (el: DiagramElement): string | undefined => {
  const props = el.properties ?? [];
  return (props.find(p => p.property_type === "Тег" && p.name) ?? props.find(p => p.name))?.name;
};

/**
 * Ссылки биндинга на свойства других компонентов, очищенные для шаблона.
 *
 * `propertyId`/`componentId` — номера ИСХОДНОЙ сцены; в шаблоне они адресуют чужие
 * сущности. Ссылка восстанавливается на месте по `componentKey` + `propertyName`
 * (ключи перекладывает `addTemplate`, номер проставляет `addTags` при назначении тега).
 */
const stripRefIds = (refs: unknown): unknown => {
  if (!Array.isArray(refs)) return refs;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return refs.map(({propertyId: _pid, componentId: _cid, ...rest}) => rest);
};

/**
 * Возвращать ли серверные id вложенных сущностей.
 *
 * В сцене — да, это обязательство контракта (§2). В шаблоне — НЕТ: у DTO шаблона нет
 * `id` ни на одном уровне, сущности связываются по именам, а id, попавший в шаблон из
 * сцены, адресует чужую сущность. Флаг существует ровно ради этой разницы.
 */
type EncodeOptions = {withServerIds?: boolean};

/**
 * TagBinding → DTO: биндинг целиком уезжает JSON-строкой в опак-поле `script`
 * (как states[].image — без изменения контракта бэкенда). Обратный путь —
 * parseBindings при загрузке.
 */
const encodeBindings = (
  el: DiagramElement,
  {withServerIds = true}: EncodeOptions = {},
): BindingDto[] =>
  Array.isArray(el.bindings)
    ? el.bindings.map(b => {
        // Серверные поля живут в DTO-обёртке, а не внутри опак-строки `script`:
        // вырезаем их перед сериализацией, иначе в JSON осел бы id, который сервер мог
        // уже не знать (свойство удалили и завели заново — номер сменился).
        const {serverId, componentPropertyId, componentPropertyName, ...payload} = b;

        // В шаблоне номера свойств бессмысленны — ссылки живут по именам и ключам.
        const script = withServerIds
          ? payload
          : {...payload, ...(payload.propertyRefs ? {propertyRefs: stripRefIds(payload.propertyRefs)} : {})};

        // В шаблоне номера свойств не отдаём ВООБЩЕ: у его DTO нет id ни на одном
        // уровне, сущности связываются по именам (§2 контракта версий). Прежний код
        // подставлял сюда `firstSavedPropertyId` — то есть номер свойства ИСХОДНОЙ
        // сцены, который в другой сцене адресует чужую сущность или ничего.
        const propertyId = withServerIds
          ? (componentPropertyId ?? firstSavedPropertyId(el))
          : undefined;
        // Имя отправляем ВСЕГДА. У свойства, созданного в этом же запросе, номера ещё нет,
        // и привязать биндинг бэкенд может только по `component_property_name`. В сцене
        // имя вдобавок переживает снимок версии, чего не делает номер (свойство, удалённое
        // и заведённое заново, получает новый id).
        const propertyName = (withServerIds ? componentPropertyName : undefined)
          ?? firstSavedPropertyName(el);

        return {
          // Пришёл с id — возвращаем тот же (§2 контракта): без него переименование
          // биндинга читается как «удалили один, создали другой».
          ...(withServerIds && serverId != null ? {id: serverId} : {}),
          // Пару «свойство» возвращаем как получили. Своё значение вычисляем только для
          // новых биндингов: имя нужно снимку версии, а номер снимок не переживает.
          // Сохранённых свойств нет — поле ОПУСКАЕМ: нулевого свойства не существует.
          ...(propertyId != null ? {component_property_id: propertyId} : {}),
          ...(propertyName != null ? {component_property_name: propertyName} : {}),
          name: b.name ?? "",
          script: JSON.stringify(script),
        };
      })
    : [];

/**
 * ElementEvents → DTO: `script` — сырой код обычно (как хочет бэкенд), а если у
 * обработчика есть propertyRefs (ссылки на свойства других компонентов, контракту
 * неизвестные) — JSON-конверт `{v:1, code, propertyRefs}` (симметрия с encodeBindings).
 * Обратный путь — parseEvents при загрузке.
 */
const encodeEvents = (
  el: DiagramElement,
  {withServerIds = true}: EncodeOptions = {},
): {id?: number | string; event_type: string; script: string}[] =>
  Array.isArray(el.events)
    ? el.events
        .filter(e => e.handler?.code?.trim())
        .map(e => ({
          // Пришёл с id — возвращаем тот же (§2 контракта). Сами события сервер
          // сопоставляет по event_type, так что id здесь ради снимка версии.
          ...(withServerIds && e.serverId != null ? {id: e.serverId} : {}),
          event_type: e.event_type,
          script: e.handler.propertyRefs?.length
            ? JSON.stringify({v: 1, code: e.handler.code, propertyRefs: e.handler.propertyRefs})
            : e.handler.code,
        }))
    : [];

const buildBaseImage = (el: DiagramElement): Record<string, unknown> => {
  const visualProps = {...el} as Record<string, unknown>;

  delete visualProps.id;
  delete visualProps.key;
  delete visualProps.label;
  delete visualProps.parentId;
  delete visualProps.parentKey;
  delete visualProps.type;
  delete visualProps.children;
  delete visualProps.composition; // список ключей примитивов — запекается отдельно, не в base
  delete visualProps.scripts;
  delete visualProps.bindings;
  delete visualProps.events;
  delete visualProps.properties;
  delete visualProps.states;

  // isComponent намеренно оставляем в image — по нему восстанавливаем флаг при загрузке.
  return visualProps;
};

/**
 * Дескриптор примитива для запекания в image компонента: визуальные поля примитива
 * в конкретном состоянии (сопоставление по имени состояния, fallback — дефолтное).
 */
const buildShapeDescriptor = (
  primitive: DiagramElement,
  stateName: string,
): Record<string, unknown> => {
  const base = buildBaseImage(primitive);
  const state =
    primitive.states.find(s => s.name === stateName) ??
    primitive.states.find(s => s.isDefault) ??
    primitive.states[0];

  return {
    type: primitive.type,
    key: primitive.key,
    ...base,
    ...(state?.overrides ?? {}),
    // Данные примитива (теги/скрипты/биндинги/события) — иначе теряются при round-trip:
    // buildBaseImage их удаляет, а unbake восстанавливал бы пустые массивы.
    //
    // Серверные id здесь вырезаны намеренно. Примитив composition не сущность бэкенда:
    // он живёт внутри опак-строки `image`, и id ему адресовать нечего. Сверх того, при
    // слиянии `image` сравнивается целым блобом — любая необязательная величина внутри
    // означала бы конфликт там, где визуально ничего не менялось.
    ...(primitive.scripts?.length
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ? {scripts: primitive.scripts.map(({serverId, ...s}) => s)}
      : {}),
    ...(Array.isArray(primitive.bindings) && primitive.bindings.length
      ? {
          bindings: primitive.bindings.map(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ({serverId, componentPropertyId, componentPropertyName, ...b}) => b,
          ),
        }
      : {}),
    ...(primitive.events?.length ? {events: encodeEvents(primitive, {withServerIds: false})} : {}),
    ...(primitive.properties?.length ? {properties: primitive.properties} : {}),
  };
};

const getOrderedChildren = (element: DiagramElement, elements: DiagramElement[]) => {
  const directChildren = elements.filter(child => String(child.parentKey) === String(element.key));
  const directChildrenMap = new Map(directChildren.map(child => [child.key, child]));

  return element.children?.length
    ? [
        ...element.children
          .map(childKey => directChildrenMap.get(String(childKey)))
          .filter((child): child is DiagramElement => Boolean(child)),
        ...directChildren.filter(child => !element.children.includes(child.key)),
      ]
    : directChildren;
};

const buildComponentNode = (element: DiagramElement, elements: DiagramElement[]): ComponentCreateDto => {
  const baseImage = buildBaseImage(element);

  const byKey = new Map(elements.map(e => [e.key, e] as const));

  // Компонент: примитивы composition запекаются в image, узлами идут только компоненты.
  // «Глупая» группа / прочее: поведение как раньше — все прямые дети становятся узлами.
  const compositionPrimitives = element.isComponent
    ? (element.composition ?? [])
        .map(k => byKey.get(k))
        .filter((e): e is DiagramElement => Boolean(e))
    : [];
  const childNodes = element.isComponent
    ? (element.children ?? [])
        .map(k => byKey.get(k))
        .filter((e): e is DiagramElement => Boolean(e))
    : getOrderedChildren(element, elements);

  const states = (element.states.length ? element.states : [{id: "default", name: "Нормальное", overrides: {}, isDefault: true}])
    .map((state, index) => {
      const stateImage: Record<string, unknown> = {...baseImage, ...(state.overrides ?? {})};
      if (element.isComponent && compositionPrimitives.length) {
        stateImage.composition = compositionPrimitives.map(p => buildShapeDescriptor(p, state.name));
      }
      return {
        // Пришедший с сервера id обязан вернуться тем же — иначе переименование
        // состояния читается как «удалили и создали заново» (§2 контракта версий).
        // Локальный uuid новых состояний не отправляем: сервер их создаст сам.
        ...(state.serverId != null ? {id: state.serverId} : {}),
        name: state.name,
        image: JSON.stringify(stateImage),
        isDefault: state.isDefault ?? index === 0,
      };
    });

  return {
    id: element.id,
    key: element.key,
    name: element.label ?? "",
    children: childNodes.map(child => buildComponentNode(child, elements)),
    version: 0,
    type: element.type,
    parent_key: element.parentKey,
    parent_id: element.parentId,
    scripts: Array.isArray(element.scripts)
      ? element.scripts.map((s) => ({
          // Пришёл с id — возвращаем тот же (§2 контракта): у скрипта есть имя, и без id
          // переименование читается сервером как «удалили и создали заново».
          ...(s.serverId != null ? {id: s.serverId} : {}),
          name: s.name,
          script: s.content,
        }))
      : [],
    bindings: encodeBindings(element),
    events: encodeEvents(element),
    states,
    // Свойства едут ЦЕЛИКОМ и у любого типа элемента: отдельного REST-пути у них
    // больше нет, они обычная часть сцены.
    //
    // Список задаёт ВЕСЬ набор свойств компонента — чего в нём нет, то бэкенд удалит
    // (сопоставление сначала по id, потом по имени). Отсюда два следствия:
    //   - фильтровать список нельзя. Раньше у таблицы отправлялись только строки
    //     (isRowBindingProperty), и любое обычное свойство таблицы стиралось на сервере
    //     при каждом сохранении;
    //   - собирать его надо ровно из element.properties, без промежуточных условий.
    properties: element.properties ?? [],
  };
};

/** Корневые компоненты сцены; в `children` — полные вложенные объекты (рекурсивно). */
export const buildComponentTree = (
  elements: DiagramElement[],
  parentKey: string | null = null,
): ComponentCreateDto[] => {
  const rootElements = elements.filter(el => String(el.parentKey) === String(parentKey));
  return rootElements.map(el => buildComponentNode(el, elements));
};

export const buildPaletteComponentTree = (
  elements: DiagramElement[],
  rootKey: string | null = null
): Record<string, any> | null => {
  const rootElement = rootKey
    ? elements.find(el => String(el.key) === String(rootKey))
    : elements.find(el => el.parentKey === null);

  if (!rootElement) return null;

  const byKey = new Map(elements.map(e => [e.key, e] as const));

  const buildNestedNode = (element: DiagramElement): Record<string, any> => {
    const baseImage = buildBaseImage(element);

    // Композиция запекается в image, как и в сцене (buildComponentNode). Без этого
    // компонент возвращался из палитры с isComponent: true и пустым composition —
    // то есть переставал быть компонентом, а его примитивы становились обычными детьми.
    const compositionPrimitives = element.isComponent
      ? (element.composition ?? [])
          .map(k => byKey.get(k))
          .filter((e): e is DiagramElement => Boolean(e))
      : [];
    const childNodes = element.isComponent
      ? (element.children ?? [])
          .map(k => byKey.get(k))
          .filter((e): e is DiagramElement => Boolean(e))
      : getOrderedChildren(element, elements);

    // Серверные id вложенных сущностей в шаблон НЕ уезжают: у DTO шаблона их нет ни на
    // одном уровне (§2 контракта — потому для шаблонов и нет слияния), а id, попавший
    // сюда из сцены, адресовал бы чужую сущность.
    const states = (element.states.length ? element.states : [{id: "default", name: "Нормальное", overrides: {}, isDefault: true}])
      .map((state, index) => {
        const stateImage: Record<string, unknown> = {...baseImage, ...(state.overrides ?? {})};
        if (element.isComponent && compositionPrimitives.length) {
          stateImage.composition = compositionPrimitives.map(p => buildShapeDescriptor(p, state.name));
        }
        return {
          name: state.name,
          image: JSON.stringify(stateImage),
          isDefault: state.isDefault ?? index === 0,
        };
      });

    // Свойства едут в шаблон ЦЕЛИКОМ, включая теговые, но БЕЗ конкретного тега:
    // тип свойства («Тег») — это и есть «здесь нужен тег», а сам тег у каждого
    // экземпляра свой. Раньше теговые свойства выбрасывались целиком, и шаблон терял
    // то, ради чего его в основном и сохраняют.
    // Серверные id снимаются: экземпляр заводит свои свойства сам (addTags при
    // назначении тега).
    const templateProperties = Array.isArray(element.properties)
      ? element.properties.map(({id: _id, component_id: _cid, ...rest}: any) => ({
          ...rest,
          tag_id: null,
        }))
      : [];

    return {
      // Шаблон не несёт серверных id ни на одном уровне — в том числе узловой.
      id: null,
      key: element.key,
      name: element.label ?? "",
      children: childNodes.map(child => buildNestedNode(child)),
      version: 0,
      type: element.type,
      parent_key: element.parentKey,
      parent_id: element.parentId,
      scripts: Array.isArray(element.scripts)
        ? element.scripts.map((s: any) => ({ name: s.name, script: s.content }))
        : [],
      bindings: encodeBindings(element, {withServerIds: false}),
      events: encodeEvents(element, {withServerIds: false}),
      states,
      properties: templateProperties,
    };
  };

  return buildNestedNode(rootElement);
};

export const buildSingleComponentTree = (
  elements: DiagramElement[],
  rootKey: string | null = null // Ключ элемента, который мы считаем корнем
): ComponentCreateDto | null => {

  // 1. Ищем конкретный корневой элемент.
  // Если rootKey не передан, берем первый элемент, у которого parentKey === null
  const rootElement = rootKey
    ? elements.find(el => String(el.key) === String(rootKey))
    : elements.find(el => el.parentKey === null);

  if (!rootElement) return null;

  return buildComponentNode(rootElement, elements);
};