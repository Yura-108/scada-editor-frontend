import OpenAddPropertyModal from "@/components/ui/OpenChooseTagModal";
import { PropertyCreateDto } from "@/types/tags.types";

export const handleAddProperty = (id: number | null, property?: PropertyCreateDto) => {
  if (!id) return;
  OpenAddPropertyModal({ component_id: id, property });
}
