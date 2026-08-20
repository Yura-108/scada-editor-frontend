import {ElementType} from "@/types/editorElement.type";
import {elementRegistry} from "@/constants/propertiesPanel";

export function getComposition(type: ElementType): boolean {
  return elementRegistry[type].complex;
}