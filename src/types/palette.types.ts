import {DiagramElement} from "@/types/editorElement.type";

export interface PaletteItemType {
  type: string;
  label: string;
  category: string;
  defaultProps: Record<string, any>;
  template?: DiagramElement[];
}

