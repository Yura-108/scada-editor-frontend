import {DiagramElement} from "@/types/editorElement.type";
import {createUuid} from "@/lib/createUuid";
import {snap} from "@/lib/utils";
import {findTemplateRoot} from "@/lib/editor/templateRoot";
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {shiftElementPositions} from "@/lib/editor/shiftPositions";
import {
  detachPropertyIds,
  detachServerBindingIds,
  detachServerEventIds,
  detachServerScriptIds,
  detachServerStateIds,
  remapPropertyRefs,
} from "@/lib/editor/detachServerIds";

export interface TemplateInstanceOptions {
  /** Куда встаёт корень, в МИРОВЫХ координатах. Снап к сетке делается здесь. */
  x: number;
  y: number;
  sceneId: number | null;
  /** Подпись корня (видна в «Слоях»). Палитра её не задаёт, импорт — задаёт. */
  label?: string;
  /** Произвольные поля корню: переживают сохранение через `states[].image`. */
  extra?: Record<string, unknown>;
}

/**
 * Делает из шаблона палитры готовый к добавлению набор элементов.
 *
 * Одна реализация на две точки входа — клик по палитре (`addTemplate`) и импорт плана
 * устройств, — чтобы они не разъехались. Функция НИЧЕГО не пишет в стор: возвращает
 * массив, а как его положить (по одному или пачкой в один шаг undo), решает вызывающий.
 *
 * Границы корня считаются по ИСХОДНОМУ массиву до клонирования: `getElementBoundsRendered`
 * ищет активное состояние по ключу элемента, и для чужих ключей берёт состояние по
 * умолчанию — именно это нам и нужно. Поменять порядок значит начать мерить копию,
 * которой в сторе тоже нет, но уже по другим ключам.
 */
export const instantiateTemplate = (
  template: DiagramElement[],
  opts: TemplateInstanceOptions,
): DiagramElement[] => {
  const x = snap(opts.x);
  const y = snap(opts.y);

  const keyMap: Record<string, string> = {};
  template.forEach(el => {
    keyMap[el.key] = createUuid();
  });

  const root = findTemplateRoot(template) ?? template[0];

  // Куда встанет корень. У группы позиция всегда в базе — её достаточно
  // записать. У одиночного элемента (в палитру сохраняют и такие) живая
  // позиция лежит в overrides состояния, а у линии её нет вовсе: там
  // x1/y1/x2/y2. Поэтому не-группу СДВИГАЕМ на разницу между точкой
  // постановки и её отрисованным габаритом: запись x/y в базу оставила бы
  // overrides со старой позицией, и элемент приехал бы туда, где его
  // сохранили.
  const rootIsGroup = root.type === "group";
  const rootBounds = rootIsGroup ? null : getElementBoundsRendered(root, template);
  const rootDx = rootBounds ? x - rootBounds.minX : 0;
  const rootDy = rootBounds ? y - rootBounds.minY : 0;

  return template.map(el => {
    // 1. Формируем базовый обновленный элемент (меняем только ключи и связи)
    const updatedElement = {
      ...el,
      id: null,
      key: keyMap[el.key],
      parentKey: el.parentKey ? (keyMap[el.parentKey] || el.parentKey) : null,
      children: el.children ? el.children.map(childKey => keyMap[childKey] || childKey) : undefined,
      composition: el.composition ? el.composition.map(k => keyMap[k] || k) : [],
      // Экземпляр шаблона — новая сущность сцены; серверные id вложенных
      // сущностей принадлежат самому шаблону и уехать вместе с копией не должны.
      scripts: detachServerScriptIds(el.scripts),
      // Ссылки на свойства соседей перекладываем на новые ключи копии — иначе они
      // продолжали бы адресовать элементы ИСХОДНОЙ сцены.
      bindings: detachServerBindingIds(el.bindings)
        .map(b => remapPropertyRefs(b, keyMap)),
      ...(el.events
        ? {events: (detachServerEventIds(el.events) ?? [])
            .map(e => e.handler
              ? {...e, handler: remapPropertyRefs(e.handler, keyMap)}
              : e)}
        : {}),
      states: detachServerStateIds(el.states),
      // Свойства шаблона — черновики: серверные номера принадлежат самому шаблону,
      // а тега у них нет вовсе (см. buildPaletteComponentTree). Экземпляр заводит
      // свои свойства при назначении тега.
      properties: detachPropertyIds(el.properties),
      // Дочерние элементы шаблона ещё не сохранены на сервере,
      // поэтому parentId у них null — бэкенд проставит id при сохранении сцены.
      // Тип расширяем явно: у корня сюда ляжет id сцены, а вывод по литералу
      // зафиксировал бы поле как `null` и запретил присваивание ниже.
      parentId: null as number | null,
    };

    // 2. Если это НАШ корневой элемент — задаем ему новые координаты на холсте
    //    и привязываем к текущей сцене (parentId = scene.id, parentKey = String(scene.id)).
    if (el.key === root.key) {
      updatedElement.parentKey = String(opts.sceneId);
      updatedElement.parentId = opts.sceneId;

      if (opts.label !== undefined) updatedElement.label = opts.label;
      if (opts.extra) Object.assign(updatedElement, opts.extra);

      if (rootIsGroup) {
        updatedElement.x = x;
        updatedElement.y = y;
      } else {
        return shiftElementPositions(updatedElement as DiagramElement, rootDx, rootDy);
      }
    }

    return updatedElement as DiagramElement;
  });
};
