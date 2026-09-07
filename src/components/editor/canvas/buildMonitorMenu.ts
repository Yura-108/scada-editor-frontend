import { DiagramElement } from "@/types/editorElement.type";
import { emitRuntimeScript } from "@/lib/runtime/runtimeEventBus";
import { openElementOptionsModal } from "@/components/monitor/ElementOptionsModal";
import type { CanvasMenuItem } from "./types";

/** Свойства элемента, привязанные к тегу — их и переназначают через «Опции». */
export const tagProperties = (el: DiagramElement) =>
  (el.properties ?? []).filter(p => p.property_type === "Тег");

/** Скрипты, помеченные автором схемы как действие монитора (ElementScript.displayed). */
export const monitorActions = (el: DiagramElement) =>
  (el.scripts ?? []).filter(s => s.displayed);

export interface BuildMonitorMenuDeps {
  closeMenu: () => void;
  /** Сессия рантайма поднята: без неё ACTION уходить некуда. */
  isLive: boolean;
}

/**
 * Пункты меню компонента в мониторе (правый клик).
 *
 * Пустой массив — меню не открывается вовсе: у компонента нечего настраивать и
 * нечего запускать.
 */
export function buildMonitorMenu(el: DiagramElement, deps: BuildMonitorMenuDeps): CanvasMenuItem[] {
  const { closeMenu, isLive } = deps;
  const items: CanvasMenuItem[] = [];

  if (tagProperties(el).length) {
    items.push({
      label: "Опции",
      onClick: () => {
        closeMenu();
        openElementOptionsModal({ elementKey: el.key });
      },
    });
  }

  for (const script of monitorActions(el)) {
    // sendAction адресует скрипт ЧИСЛОВЫМ серверным id; у скрипта, созданного и ещё
    // не сохранённого в редакторе, там uuid — запускать нечего (см. runScriptOn).
    const isSaved = Number.isFinite(Number(script.id));
    const reason = !isSaved ? " — схема не сохранена"
      : !isLive ? " — нет связи"
      : "";
    items.push({
      label: `${script.name}${reason}`,
      disabled: !isSaved || !isLive,
      onClick: () => {
        closeMenu();
        emitRuntimeScript(el.key, script.name);
      },
    });
  }

  return items;
}
