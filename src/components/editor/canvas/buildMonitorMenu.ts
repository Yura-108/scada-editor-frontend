import { DiagramElement } from "@/types/editorElement.type";
import { emitRuntimeScript } from "@/lib/runtime/runtimeEventBus";
import { confirmMonitorAction } from "@/lib/runtime/confirmMonitorAction";
import { openElementOptionsModal } from "@/components/monitor/ElementOptionsModal";
import { openTrendModal } from "@/components/monitor/TrendModal";
import { trendPens } from "@/lib/editor/trendSettings";
import type { CanvasMenuItem } from "./types";

/**
 * Свойства элемента, привязанные к тегу — их и переназначают через «Опции».
 *
 * У тренда тег-свойства — это перья: писать в ПЛК с графика нечего, поэтому «Опций» у
 * него нет, вместо них — «Открыть тренд».
 */
export const tagProperties = (el: DiagramElement) =>
  el.type === "trend" ? [] : (el.properties ?? []).filter(p => p.property_type === "Тег");

/** Тренд с хотя бы одним пером — его можно открыть в окне просмотра. */
export const isOpenableTrend = (el: DiagramElement) =>
  el.type === "trend" && trendPens(el).length > 0;

/** Скрипты, помеченные автором схемы как действие монитора (ElementScript.displayed). */
export const monitorActions = (el: DiagramElement) =>
  (el.scripts ?? []).filter(s => s.displayed);

export interface BuildMonitorMenuDeps {
  closeMenu: () => void;
  /** Сессия рантайма поднята: без неё ACTION уходить некуда. */
  isLive: boolean;
  /** Режим «Архив»: только просмотр — из пунктов остаётся «Открыть тренд». */
  archive?: boolean;
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
  tagProperties(el).length > 0 || monitorActions(el).length > 0 || isOpenableTrend(el);

export function buildMonitorMenu(el: DiagramElement, deps: BuildMonitorMenuDeps): CanvasMenuItem[] {
  const { closeMenu, isLive, archive } = deps;
  const items: CanvasMenuItem[] = [];

  // Архив доступен и без живой сессии — пункт не зависит от isLive.
  if (isOpenableTrend(el)) {
    items.push({
      label: "Открыть тренд",
      onClick: () => {
        closeMenu();
        openTrendModal({ elementKey: el.key });
      },
    });
  }

  if (archive) return items;

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
        // Меню закрываем ДО подтверждения: иначе оно осталось бы висеть под диалогом.
        // Пункт меню синхронный по типу, поэтому асинхронная часть уходит в `void (async…)()`.
        closeMenu();
        void (async () => {
          if (await confirmMonitorAction({element: el, scriptName: script.name})) {
            emitRuntimeScript(el.key, script.name);
          }
        })();
      },
    });
  }

  return items;
}
