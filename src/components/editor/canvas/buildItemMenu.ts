import { DiagramElement } from "@/types/editorElement.type";
import { useEditorStore } from "@/store/useEditorStore";
import { getDescendants } from "@/lib/getDescendants";
import { handleAddProperty } from "@/lib/handleAddProperty";
import { OpenCreateFaceplateModal } from "@/components/ui/OpenCreateFaceplateModal";
import { promptModal } from "@/components/ui/ConfirmModal";
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

  // В палитру уходит поддерево целиком: и группа с потомками, и одиночный элемент
  // (у него getDescendants вернёт пустой список). Корень всегда первый в массиве —
  // на этом порядке стоит findTemplateRoot.
  const handleFaceplate = () => {
    const allDescendants = getDescendants(el.key, elements);
    OpenCreateFaceplateModal([el, ...allDescendants]);
    closeMenu();
  };

  const handleCreateComponent = async () => {
    closeMenu();
    const name = await promptModal({
      title: "Создать компонент",
      description: "Примитивы группы станут составом компонента и будут запечены в его изображение.",
      label: "Название компонента",
      defaultValue: el.label || "Компонент",
      confirmLabel: "Создать",
    });
    if (name === null) return;
    useEditorStore.getState().createComponentFromGroup(el.key, name || undefined);
  };

  const handleDisassemble = () => {
    useEditorStore.getState().disassembleComponent(el.key);
    closeMenu();
  };

  const items: (CanvasMenuItem | null)[] = [
    { label: "Добавить свойство", onClick: () => { handleAddProperty(el.key); closeMenu(); } },
    { label: "На передний план", onClick: () => { useEditorStore.getState().bringToFront(el.key); closeMenu(); } },
    { label: "На задний план", onClick: () => { useEditorStore.getState().sendToBack(el.key); closeMenu(); } },
    // Пункты задаём явно. Раньше они брались из editorElementMenuItems, а действие
    // выбиралось СРАВНЕНИЕМ РУССКОЙ ПОДПИСИ; исходные обработчики там — заглушки
    // console.log, поэтому любая опечатка или переименование подписи молча
    // превращали пункт в no-op.
    { label: "Повернуть по часовой", onClick: () => { useEditorStore.getState().transformSelected("cw"); closeMenu(); } },
    { label: "Повернуть против часовой", onClick: () => { useEditorStore.getState().transformSelected("ccw"); closeMenu(); } },
    { label: "Отразить по горизонтали", onClick: () => { useEditorStore.getState().transformSelected("flipH"); closeMenu(); } },
    { label: "Отразить по вертикали", onClick: () => { useEditorStore.getState().transformSelected("flipV"); closeMenu(); } },
    { label: "Копировать", onClick: () => { copySelectedElement(); closeMenu(); } },
    { label: "Переместить в группу", onClick: () => { openMoveToGroup(el.key); closeMenu(); } },
    { label: "Удалить", onClick: () => { deleteSelectedElement(); closeMenu(); }, variant: "danger" },
    isPlainGroup ? { label: "Создать компонент", onClick: handleCreateComponent } : null,
    isComponent ? { label: "Добавить компонент", onClick: () => { openAddComponent(el.key); closeMenu(); } } : null,
    isComponent ? { label: "Разобрать компонент", onClick: handleDisassemble } : null,
    { label: "Сохранить в палитру", onClick: handleFaceplate },
  ];

  return items.filter((i): i is CanvasMenuItem => Boolean(i));
}
