import { DiagramElement } from "@/types/editorElement.type";
import { emitRuntimeScript } from "@/lib/runtime/runtimeEventBus";
import { confirmMonitorAction } from "@/lib/runtime/confirmMonitorAction";
import { openElementOptionsModal } from "@/components/monitor/ElementOptionsModal";
import { openObjectInspectorModal } from "@/components/monitor/ObjectInspectorModal";
import { openTrendModal } from "@/components/monitor/TrendModal";
import { trendPens } from "@/lib/editor/trendSettings";
import type { MenuChoice } from "@/lib/runtime/eventScript";
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

  // Инспектор — все свойства объекта, не только с тегом. Только при живой сессии: значения и
  // запись идут через движок (в архиве сюда не доходим — меню возвращается выше).
  // `el.id` — серверный id компонента, на схемах выпуска он есть всегда.
  if (isLive && typeof el.id === "number") {
    const objectId = el.id;
    items.push({
      label: "Инспектор",
      onClick: () => {
        closeMenu();
        openObjectInspectorModal({ initialObjectId: objectId });
      },
    });
  }

  for (const script of monitorActions(el)) {
    const reason = unavailableReason(el, script.name, isLive);
    items.push({
      label: `${script.name}${reason}`,
      disabled: reason !== "",
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

/**
 * Почему серверный скрипт сейчас не запустить ("" — можно).
 *
 * sendAction адресует скрипт ЧИСЛОВЫМ серверным id; у скрипта, созданного и ещё
 * не сохранённого в редакторе, там uuid — запускать нечего (см. runScriptOn).
 */
const unavailableReason = (el: DiagramElement, scriptName: string, isLive: boolean): string => {
  const script = el.scripts?.find(s => s.name === scriptName);
  if (!script) return " — нет скрипта";
  if (!Number.isFinite(Number(script.id))) return " — схема не сохранена";
  if (!isLive) return " — нет связи";
  return "";
};

/**
 * Меню выбора, построенное `onClick` вызовом `showMenu(items)`: каждый пункт запускает
 * серверный скрипт элемента со своими `args`. Подтверждение — на выбранном пункте, с его
 * подписью: сам клик, открывший меню, ничего не писал и не подтверждался
 * (isNonWritingScript).
 */
export function buildChoiceMenu(
  el: DiagramElement,
  choices: MenuChoice[],
  deps: Pick<BuildMonitorMenuDeps, "closeMenu" | "isLive">,
): CanvasMenuItem[] {
  const { closeMenu, isLive } = deps;
  return choices.map(choice => {
    const reason = unavailableReason(el, choice.script, isLive);
    return {
      label: `${choice.label}${reason}`,
      disabled: reason !== "",
      onClick: () => {
        // Как у пунктов действий: меню закрываем ДО диалога.
        closeMenu();
        void (async () => {
          if (await confirmMonitorAction({element: el, scriptName: choice.script, choice: choice.label})) {
            emitRuntimeScript(el.key, choice.script, choice.args);
          }
        })();
      },
    };
  });
}
