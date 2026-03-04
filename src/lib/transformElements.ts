import {ComponentCreateDto} from "@/types/editorElement.type";

type ComponentDto = Omit<ComponentCreateDto, 'children'> & {
  id: number;
  children: ComponentDto[];
}

export default function transformElements(apiElements: ComponentDto[]) {
  const result: any[] = [];

  function processElement(el: ComponentDto, parentUuid: string | null = null) {
    const currentUuid = crypto.randomUUID();

    const childIds: string[] = [];
    if (el.children && el.children.length > 0) {
      el.children.forEach((child: any) => {
        const processedChild = processElement(child, currentUuid);
        childIds.push(processedChild.key);
      });
    }

    const flattenedElements = {
      id: el.id,
      key: currentUuid,
      type: el.type,
      ...(el.image || {}),
      parentId: el.parent_id,
      parentKey: parentUuid,
      children: childIds,
      label: el.name
    };

    result.push(flattenedElements);

    return flattenedElements;
  }

  apiElements.forEach(el => processElement(el));

  return result;
}