import OpenAddPropertyModal from "@/components/ui/OpenChooseTagModal";
import { PropertyCreateDto } from "@/types/tags.types";

/**
 * Открывает модалку свойства для элемента с этим ключом.
 *
 * Раньше здесь стоял гард `if (!id) return` — свойство нельзя было завести элементу,
 * которого ещё нет на сервере. Теперь свойства едут вместе со сценой, поэтому владелец
 * адресуется ключом, а серверный id не нужен вовсе.
 */
export const handleAddProperty = (elementKey: string | null | undefined, property?: PropertyCreateDto) => {
  if (!elementKey) return;
  OpenAddPropertyModal({ elementKey, property });
}
