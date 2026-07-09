import { DiagramElement } from "@/types/editorElement.type";
import { useEditorStore } from "@/store/useEditorStore";
import { editorElementMenuItems } from "@/constants/contextMenuItems";
import { getDescendants } from "@/lib/getDescendants";
import { handleAddProperty } from "@/lib/handleAddProperty";
import { OpenCreateFaceplateModal } from "@/components/ui/OpenCreateFaceplateModal";
import type { CanvasMenuItem } from "./types";

export interface BuildItemMenuDeps {
  elements: DiagramElement[];
  closeMenu: () => void;
  copySelectedElement: () => void;
  deleteSelectedElement: () => void;
  openMoveToGroup: (elementKey: string) => void;
  openAddComponent: (targetKey: string) => void;
}

/** Строит пункты контекстного меню для элемента холста. */
export function buildItemMenu(el: DiagramElement, deps: BuildItemMenuDeps): CanvasMenuItem[] {
  const { elements, closeMenu, copySelectedElement, deleteSelectedElement, openMoveToGroup, openAddComponent } = deps;

  const isPlainGroup = el.type === "group" && !el.isComponent;
  const isComponent = el.type === "group" && !!el.isComponent;

  const handleFaceplate = () => {
    const allDescendants = getDescendants(el.key, elements);
    OpenCreateFaceplateModal([el, ...allDescendants]);
    closeMenu();
  };

  const handleCreateComponent = () => {
    const name = prompt("Название компонента", el.label || "Компонент");
    if (name === null) { closeMenu(); return; }
    useEditorStore.getState().createComponentFromGroup(el.key, name.trim() || undefined);
    closeMenu();
  };

  const handleDisassemble = () => {
    useEditorStore.getState().disassembleComponent(el.key);
    closeMenu();
  };

  const items: (CanvasMenuItem | null)[] = [
    { label: "Добавить свойство", onClick: () => { handleAddProperty(el.id); closeMenu(); }, disabled: !el.id },
    ...editorElementMenuItems.map(item => ({
      label: item.label,
      onClick: () => {
        if (item.label === "Копировать") {
          copySelectedElement();
        } else if (item.label === "Переместить в группу") {
          openMoveToGroup(el.key);
        } else if (item.label === "Удалить") {
          deleteSelectedElement();
        } else {
          item.onClick?.();
        }
        closeMenu();
      },
    })),
    isPlainGroup ? { label: "Создать компонент", onClick: handleCreateComponent } : null,
    isComponent ? { label: "Добавить компонент", onClick: () => { openAddComponent(el.key); closeMenu(); } } : null,
    isComponent ? { label: "Разобрать компонент", onClick: handleDisassemble } : null,
    el.type === "group" ? { label: "Сохранить в палитру", onClick: handleFaceplate } : null,
  ];

  return items.filter((i): i is CanvasMenuItem => Boolean(i));
}
