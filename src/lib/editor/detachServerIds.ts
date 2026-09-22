import {DiagramElement} from "@/types/editorElement.type";
import {PropertyRef} from "@/types/binding.types";
import {createUuid} from "@/lib/createUuid";

/**
 * Снимает серверные id вложенных сущностей с копии элемента.
 *
 * `serverId` адресует КОНКРЕТНУЮ сущность на бэкенде. У копии (вставка, дублирование,
 * установка шаблона на холст) сущность новая — с `id: null`, — и отправить вместе с ней
 * чужой id состояния, скрипта, биндинга или события значит сказать серверу «это
 * состояние переехало сюда»: оригинал своё потеряет, а слияние выдаст конфликт на
 * ровном месте. Локальные `id` (React-ключи) при этом сохраняются.
 *
 * Свойства (`properties`) снимает отдельный `detachPropertyIds` — они заводятся своим
 * REST-путём (`/api/editor/tags`), а не вместе со сценой, поэтому у копии это черновики
 * без серверного номера.
 */
export const detachServerStateIds = (states: DiagramElement["states"] | undefined): DiagramElement["states"] =>
  (states ?? []).map(state => {
    if (state.serverId == null) return state;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {serverId: _serverId, ...rest} = state;
    return rest;
  });

/** Скрипты копии: новый локальный uuid + снятый серверный id. */
export const detachServerScriptIds = (
  scripts: DiagramElement["scripts"] | undefined,
): DiagramElement["scripts"] =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (Array.isArray(scripts) ? scripts : []).map(({serverId: _serverId, ...s}) => ({
    ...s,
    id: createUuid(),
  }));

/** Биндинги копии: без серверного id и без пары «свойство», присвоенной сервером. */
export const detachServerBindingIds = (
  bindings: DiagramElement["bindings"] | undefined,
): DiagramElement["bindings"] =>
  (Array.isArray(bindings) ? bindings : []).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({serverId: _s, componentPropertyId: _pid, componentPropertyName: _pname, ...b}) => b,
  );

/**
 * Свойства копии: без серверных id.
 *
 * `id` адресует свойство на бэкенде, `component_id` — его владельца; у копии владелец
 * другой. Экземпляр шаблона заводит свои свойства сам, в момент назначения тега
 * (`addTags`), а до тех пор они черновики — см. `PropertyCreateDto.id`.
 */
export const detachPropertyIds = (
  properties: DiagramElement["properties"] | undefined,
): DiagramElement["properties"] =>
  (Array.isArray(properties) ? properties : []).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({id: _id, component_id: _cid, ...rest}) => rest as DiagramElement["properties"][number],
  );

/** События копии: без серверного id (сопоставление всё равно по `event_type`). */
export const detachServerEventIds = (
  events: DiagramElement["events"] | undefined,
): DiagramElement["events"] =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (Array.isArray(events) ? events : []).map(({serverId: _serverId, ...e}) => e);

/**
 * Перекладывает ссылки на свойства других элементов на новые ключи копии.
 *
 * `propertyRefs` живут внутри биндингов и обработчиков событий и адресуют элемент по
 * `componentKey`. Без перекладки ссылки внутри поставленного шаблона продолжали бы
 * указывать на ключи ИСХОДНОЙ сцены. Номер свойства (`propertyId`) при этом снимается:
 * у копии свойство ещё не заведено, номер проставит `addTags` по паре
 * «componentKey + propertyName».
 */
export const remapPropertyRefs = <T extends {propertyRefs?: PropertyRef[]}>(
  owner: T,
  keyMap: Record<string, string>,
): T => {
  if (!owner.propertyRefs?.length) return owner;
  return {
    ...owner,
    propertyRefs: owner.propertyRefs.map(ref => {
      const componentKey = keyMap[ref.componentKey] ?? ref.componentKey;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {propertyId: _pid, componentId: _cid, ...rest} = ref;
      return {...rest, componentKey} as PropertyRef;
    }),
  };
};
