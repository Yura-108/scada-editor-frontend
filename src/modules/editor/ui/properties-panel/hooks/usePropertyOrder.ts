import {useMemo, useState} from "react";
import {PointerSensor, useSensor, useSensors, type DragEndEvent} from "@dnd-kit/core";
import {arrayMove} from "@dnd-kit/sortable";
import {DiagramElement} from "@/types/editorElement.type";
import {useEditorStore} from "../../../model/editorStore";
import {propertyKey, sortProperties} from "../lib/propertyOrder";

/** Свойства элемента в порядке показа и перестановка их перетаскиванием. */
export function usePropertyOrder(element: DiagramElement) {
  const updateElement = useEditorStore(s => s.updateElement);
  const elementProperties = useMemo(() => element.properties ?? [], [element.properties]);
  // Локальный порядок во время/сразу после драга — визуальная обратная связь до
  // того, как стор пересчитает elementProperties. Сбрасывать его при смене элемента
  // не нужно: панель пересоздаёт вкладки по ключу элемента.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const sortedProperties = useMemo(
    () => sortProperties(elementProperties, localOrder),
    [elementProperties, localOrder],
  );
  const dndSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}));

  const handlePropertyDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id) return;
    const ids = sortedProperties.map(propertyKey);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedIds = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder(reorderedIds);

    // Порядок — обычное поле свойства, уезжает со сценой. Раньше это была пачка запросов
    // editProperty (по одному на сдвинутую строку, каждый ещё и с GET версии), причём
    // необработанный reject терял половину перестановки молча.
    const orderByKey = new Map(reorderedIds.map((id, index) => [id, index] as const));
    updateElement(element.key, {
      properties: (element.properties ?? []).map(p => {
        const position = orderByKey.get(propertyKey(p));
        return position === undefined || p.position === position ? p : {...p, position};
      }),
    });
  };

  return {sortedProperties, dndSensors, handlePropertyDragEnd};
}
