import {CompositionMode, ElementType} from "@/types/editorElement.type";
import {elementRegistry} from "@/constants/propertiesPanel";

export function getComposition(type: ElementType): CompositionMode {
  return elementRegistry[type].composition;
}