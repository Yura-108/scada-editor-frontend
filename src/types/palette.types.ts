import {DiagramElement} from "@/types/editorElement.type";

export interface PaletteItemType {
  id: number;
  type: string;
  label: string;
  category: string;
  defaultProps: Record<string, any>;
  template?: DiagramElement[];
}

export interface PaletteItemResponseDTO {
  id: number;
  name: string;
  type: string;
  components: ComponentsResponseDTO[];
}

export interface ComponentCreateDTO {
  key: string;
  name: string;
  type: string;
  parent_key: string | null;
  children: ComponentCreateDTO[];
  image: any;
}

export interface ComponentsResponseDTO {
  id: number;
  parent_id: number;
  name: string;
  type: string;
  children: ComponentsResponseDTO[];
  image: any;
}
