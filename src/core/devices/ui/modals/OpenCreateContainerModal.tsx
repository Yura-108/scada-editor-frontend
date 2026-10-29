import {promptModal} from "@/shared/ui/dialog/confirmModal";
import {addDevice} from "../../model/deviceActions";

// Площадка и проект создаются по одному названию (в отличие от устройства — без выбора
// типа и шаблона), поэтому хватает общего окна ввода строки.
async function createNamedNode(title: string, description: string, placeholder: string, parentKey: string) {
  const name = await promptModal({title, description, label: "Название", placeholder, confirmLabel: "Создать"});
  if (name) void addDevice({type: 0, idNode: name, parentKey});
}

// Площадка — узел верхнего уровня (без родителя).
export function OpenCreateSiteModal() {
  void createNamedNode("Создание площадки", "Введите название новой площадки.", "Название площадки", "");
}

// Проект — узел под площадкой (parentKey — ключ площадки).
export function OpenCreateProjectModal(parentKey: string) {
  void createNamedNode("Создание проекта", "Введите название нового проекта.", "Название проекта", parentKey);
}
