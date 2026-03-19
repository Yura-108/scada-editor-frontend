import {DiagramElement} from "@/types/editorElement.type";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useEditorStore} from "@/store/useEditorStore";

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
  const queue: ComponentDto[] = [...apiElements];
  const {scene} = useEditorStore.getState();

  while (queue.length > 0) {
    const el = queue.shift();
    if (!el) continue;

    const currentKey = String(el.id);
    const currentParentKey = el.parent_id !== null ? String(el.parent_id) : String(scene?.id);

    const childKeys: string[] = [];

    if (el.children && el.children.length > 0) {
      el.children.forEach((child: any) => {
        childKeys.push(String(child.id));
        queue.push(child);
      });
    }

    const flattenedElement = {
      id: el.id,
      key: currentKey,
      type: el.type,
      ...(el.image || {}),
      parentId: el.parent_id ?? scene?.id,
      parentKey: currentParentKey,
      children: childKeys,
      label: el.name
    };

    result.push(flattenedElement);
  }

  return result;
}