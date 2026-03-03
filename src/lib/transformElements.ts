import {ComponentCreateDto} from "@/types/editorElement.type";

export default function transformElements(apiElements: ComponentCreateDto[]) {
  const result: any[] = [];

  function processElement(el: ComponentCreateDto, parentUuid: string | null = null) {
    const currentUuid = crypto.randomUUID();

    const childIds: string[] = [];
    if (el.children && el.children.length > 0) {
      el.children.forEach((child: any) => {
        const processedChild = processElement(child, currentUuid);
        childIds.push(processedChild.id);
      });
    }

    const flattenedElements = {
      id: currentUuid,
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