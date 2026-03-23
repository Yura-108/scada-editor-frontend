import {OpenChooseTagModal} from "@/components/ui/OpenChooseTagModal";

export const handleBindTag = (id: number | null) => {
  if (!id) return;
  OpenChooseTagModal(id);
}