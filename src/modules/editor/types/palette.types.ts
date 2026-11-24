import {DiagramElement} from "@/core/scene";
import {PropertyCreateDto} from "@/core/scene";

export interface PaletteItemType {
  id: number;
  type: string;
  name: string;
  category: string;
  defaultProps: Record<string, unknown>;
  template?: DiagramElement[];
  /**
   * Версия шаблона, на которой основаны текущие правки → уезжает в `based_on_version`
   * при сохранении. null/undefined — версий ещё нет (первое сохранение), поле не шлём.
   * Слияния для шаблонов не будет (у их DTO нет id на вложенных уровнях), только
   * проверка версии с 409.
   */
  versionNo?: number | null;
}

export interface PaletteItemResponseDTO {
  id: number;
  name: string;
  type: string;
  rootComponent: ComponentsResponseDTO;
  /** Появляется вместе с версионированием шаблонов; до этого — undefined. */
  version_no?: number | null;
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
  scripts: unknown[];
  bindings: unknown[];
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
  scripts?: unknown[];
  bindings?: unknown[];
  states: ComponentStateResponseDTO[];
  children: ComponentsResponseDTO[];
  properties: PropertyCreateDto[];
}
