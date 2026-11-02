import type { CanvasMenuItem } from "@/core/canvas";
import type { MonitorMenuSettings } from "@/core/scene";

/** Открытое контекстное меню холста: где, какие пункты и (в мониторе) вид меню. */
export interface CanvasMenuState {
  x: number;
  y: number;
  items: CanvasMenuItem[];
  settings?: MonitorMenuSettings;
}

export type SetCanvasMenu = (menu: CanvasMenuState | null) => void;
