import {DiagramElement} from "@/types/editorElement.type";
import {PropertyCreateDto} from "@/types/tags.types";

export interface PaletteItemType {
  id: number;
  type: string;
  name: string;
  category: string;
  defaultProps: Record<string, any>;
  template?: DiagramElement[];
}

export interface PaletteItemResponseDTO {
  id: number;
  name: string;
  type: string;
  rootComponent: ComponentsResponseDTO;
}

export type ComponentCreateDTO = {
  key: string;
  id: number | null;
  name: string;
  type: string;
  version: number;
  parent_key: string | null;
  parent_id: number | null;
  children: ComponentCreateDTO[];
  states: {
    name: string;
    image: string;
    isDefault: boolean;
  }[];
};

export interface PaletteItemCreateDTO {
  name: string;
  type: string;
  rootComponent: ComponentCreateDTO;
}

export interface ComponentStateResponseDTO {
  id: number;
  componentId: number;
  name: string;
  image: string;
  isDefault: boolean;
}

export interface ComponentsResponseDTO {
  id: number;
  key?: string;
  name: string;
  type: string;
  version: number;
  parent_id: number | null;
  states: ComponentStateResponseDTO[];
  children: ComponentsResponseDTO[];
  properties: PropertyCreateDto[];
}
