import type {DiagramElement} from "@/types/editorElement.type";
import type {PropertyRef} from "@/types/binding.types";
// переедет в core/scene вместе с остальным lib (шаг 8)
import {getElementIndex} from "@/core/scene";

/**
 * Проставляет номера свойств тем ссылкам, что их ждали.
 *
 * Ссылка на свойство соседа адресует его парой «`componentKey` + `propertyName`», а
 * маршрутизирует рантайм по `propertyId`. Номера у свойства нет, пока сцена не сохранена
 * (свойства заводятся вместе с ней), и ссылка, созданная до первого сохранения, приходит
 * без него. Здесь она его и получает — из дерева, вернувшегося в ответе сохранения.
 *
 * Ссылка без номера появляется и у экземпляра шаблона: `addTemplate` снимает чужие
 * номера, оставляя ту же пару.
 */
export const resolvePendingPropertyRefs = (elements: DiagramElement[]): DiagramElement[] => {
  const {byKey} = getElementIndex(elements);

  const idOf = (componentKey: string, propertyName: string): number | undefined =>
    (byKey[componentKey]?.properties ?? [])
      .find(p => p.name === propertyName && typeof p.id === "number")?.id;

  const fill = <T extends {propertyRefs?: PropertyRef[]}>(owner: T): T => {
    const refs = owner.propertyRefs;
    if (!refs?.length) return owner;
    let changed = false;
    const next = refs.map(ref => {
      if (ref.propertyId != null) return ref;
      const id = idOf(ref.componentKey, ref.propertyName);
      if (id == null) return ref;
      changed = true;
      return {...ref, propertyId: id};
    });
    return changed ? {...owner, propertyRefs: next} : owner;
  };

  let touched = false;
  const next = elements.map(el => {
    let changed = false;
    const bindings = (el.bindings ?? []).map(b => {
      const filled = fill(b);
      if (filled !== b) changed = true;
      return filled;
    });
    const events = (el.events ?? []).map(e => {
      if (!e.handler) return e;
      const filled = fill(e.handler);
      if (filled === e.handler) return e;
      changed = true;
      return {...e, handler: filled};
    });
    if (!changed) return el;
    touched = true;
    return {...el, bindings, ...(el.events ? {events} : {})} as DiagramElement;
  });

  // Ссылку на массив сохраняем, если ничего не изменилось: по ней завязаны equality
  // истории undo и флаг несохранённых правок.
  return touched ? next : elements;
};
