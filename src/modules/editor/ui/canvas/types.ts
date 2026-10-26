import type { CanvasMenuItem } from "@/components/editor/canvas/types";
import type { MonitorMenuSettings } from "@/types/editorElement.type";

/** Открытое контекстное меню холста: где, какие пункты и (в мониторе) вид меню. */
export interface CanvasMenuState {
  x: number;
  y: number;
  items: CanvasMenuItem[];
  settings?: MonitorMenuSettings;
}

export type SetCanvasMenu = (menu: CanvasMenuState | null) => void;
