import {DiagramElement} from "@/types/editorElement.type";

type ComponentDto = {
  id: number;
  name: string;
  type: string;
  parent_id: number;
  image: any;
  children: ComponentDto[];
}

export default function transformElements(apiElements: ComponentDto[]) {
  const result: DiagramElement[] = [];

  // 1. Создаем очередь и помещаем в нее все элементы верхнего уровня.
  // Если есть риск, что сервер пришлет массив вперемешку, можно принудительно
  // отсортировать так, чтобы parent_id === null были первыми:
  // const queue: ComponentDto[] = [...apiElements].sort((a, b) => a.parent_id === null ? -1 : 1);
  const queue: ComponentDto[] = [...apiElements];

  // 2. Пока в очереди есть элементы, обрабатываем их один за другим
  while (queue.length > 0) {
    // Достаем первый элемент из начала очереди
    const el = queue.shift();
    if (!el) continue;

    console.log(el)

    const currentKey = String(el.id);
    const currentParentKey = el.parent_id !== null ? String(el.parent_id) : null;

    const childKeys: string[] = [];

    if (el.children && el.children.length > 0) {
      el.children.forEach((child: any) => {
        childKeys.push(String(child.id));
        // 3. Самое важное: добавляем детей в КОНЕЦ очереди.
        // Они будут обработаны только после того, как закончатся все текущие родители.
        queue.push(child);
      });
    }

    const flattenedElement = {
      id: el.id,
      key: currentKey,
      type: el.type,
      ...(el.image || {}),
      parentId: el.parent_id,
      parentKey: currentParentKey,
      children: childKeys,
      label: el.name
    };

    // Пушим в итоговый массив
    result.push(flattenedElement);
  }

  return result;
}