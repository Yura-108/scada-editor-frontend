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
/**
 * Есть ли у элемента хоть один пункт меню — теговые свойства или действия монитора.
 *
 * Нужно отдельно от сборки: клик разрешается в САМЫЙ ГЛУБОКИЙ элемент, а теги и скрипты
 * в схемах обычно висят на компоненте, тогда как его внутренние примитивы пусты. Без
 * подъёма до ближайшего предка с пунктами ПКМ по такому примитиву не открывал бы ничего.
 */
export const hasMonitorMenu = (el: DiagramElement): boolean =>
  tagProperties(el).length > 0 || monitorActions(el).length > 0;

export function buildMonitorMenu(el: DiagramElement, deps: BuildMonitorMenuDeps): CanvasMenuItem[] {
  const { closeMenu, isLive } = deps;
  const items: CanvasMenuItem[] = [];

  if (tagProperties(el).length) {
    // Без живой сессии в «Опциях» нечего показывать (значений нет) и некуда писать.
    items.push({
      label: isLive ? "Опции" : "Опции — нет связи",
      disabled: !isLive,
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
