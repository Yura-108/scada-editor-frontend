import OpenAddPropertyModal from "@/components/ui/OpenChooseTagModal";

export const handleAddProperty = (id: number | null) => {
  if (!id) return;
  OpenAddPropertyModal(id);
}

