import { useEffect, useRef, type RefObject } from "react";
import Konva from "konva";
import { readMonitorMenu } from "@/core/scene";
import { isRuntimeLive, setRuntimeMenuHandler } from "@/lib/runtime/runtimeEventBus";
import { buildChoiceMenu } from "@/components/editor/canvas/buildMonitorMenu";
import { useEditorStore } from "../../../model/editorStore";
import type { SetCanvasMenu } from "../types";
import { useMonitorPointer } from "./useMonitorPointer";
import { usePendingMonitorMenu } from "./usePendingMonitorMenu";

interface UseMonitorClicksArgs {
  stageRef: RefObject<Konva.Stage | null>;
  readOnly: boolean;
  archive: boolean;
  closeMenu: () => void;
  setContextMenu: SetCanvasMenu;
  enterGroup: (key: string) => void;
}

/** Монитор: меню по ПКМ, ЛКМ и касанию, вход в компонент двойным кликом, меню `showMenu`. */
export function useMonitorClicks({ stageRef, readOnly, archive, closeMenu, setContextMenu, enterGroup }: UseMonitorClicksArgs) {
  // Обработчики монитора не пересоздаются на смену режима — читают его через ref.
  const archiveRef = useRef(archive);
  useEffect(() => { archiveRef.current = archive; }, [archive]);

  const { resolveMonitorMenu, containerAtPointer } = useMonitorPointer({ stageRef, archiveRef, closeMenu });
  const pendingMenu = usePendingMonitorMenu();
  const { cancel: cancelPendingMonitorMenu } = pendingMenu;
  // Метка последнего касания — чтобы эмулированный браузером `click` после `tap` не
  // считался вторым кликом.
  const lastTapAtRef = useRef(0);

  // Монитор: Escape поднимает на уровень вверх. Общий useEditorHotkeys здесь включать
  // нельзя — он тянет удаление, копирование и группировку, которых в мониторе быть не
  // должно. Меню закрывает Escape раньше нас (свой слушатель в capture-фазе).
  useEffect(() => {
    if (!readOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useEditorStore.getState();
      if (s.activeGroupKey) s.exitGroup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly]);

  const handleMonitorContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    cancelPendingMonitorMenu();
    const menu = resolveMonitorMenu({ x: e.evt.clientX, y: e.evt.clientY });
    if (menu) setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, ...menu });
  };

  /**
   * Монитор: ЛКМ или касание по компоненту без скрипта `onClick` открывает то же меню,
   * что и ПКМ. На сенсорной панели правой кнопки нет, и без этого «Опции» и действия там
   * были недоступны. Клик, который отработал скриптом `onClick`, сюда не доходит: его
   * область в MonitorInteractionLayer гасит всплытие.
   *
   * Меню откладывается на окно двойного клика, если двойной клик здесь что-то значит
   * (вход в группу, скрипт `onDoubleClick`): меню открывается под курсором, и второй
   * клик попал бы в его пункт, а не на холст, — Konva не увидела бы двойного клика, а
   * оператор нажал бы «Опции» или действие. Второй клик в окне снимает отложенное меню.
   *
   * Касание откладывается всегда: на пустом месте Konva не гасит касание, и браузер
   * следом шлёт эмулированные mousedown/click — mousedown закрыл бы только что открытое
   * меню (useStageInteractions), а click сошёл бы за второй клик.
   */
  const handleMonitorClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const isTouch = e.type === "tap";
    if (isTouch) {
      lastTapAtRef.current = performance.now();
    } else {
      if ((e.evt as MouseEvent).button !== 0) return;
      if (performance.now() - lastTapAtRef.current < Konva.dblClickWindow) return;
    }

    // Второй клик в окне — это двойной клик, его разберёт handleMonitorDblClick.
    if (pendingMenu.isPending()) {
      cancelPendingMonitorMenu();
      return;
    }

    const point = "changedTouches" in e.evt
      ? e.evt.changedTouches[0]
      : e.evt;
    if (!point) return;
    const menu = resolveMonitorMenu({ x: point.clientX, y: point.clientY });
    if (!menu) return;
    const open = () => setContextMenu({ x: point.clientX, y: point.clientY, ...menu });

    const dblClickMatters = isTouch
      || e.target !== e.target.getStage()   // область скрипта onDoubleClick
      || containerAtPointer() !== null;
    if (!dblClickMatters) { open(); return; }

    pendingMenu.schedule(open);
  };

  // Монитор: двойной клик входит внутрь составного компонента — та же механика уровня
  // (activeGroupKey), что и в редакторе, чтобы меню можно было вызвать у вложенного.
  const handleMonitorDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Двойной клик — не два одиночных: отложенное меню первого клика не показываем.
    cancelPendingMonitorMenu();

    // Клик поглотила хит-область слоя интеракции — значит он адресован элементу с
    // обработчиком события (на любой глубине), и тот уже отработал. Перехватывать
    // такой двойной клик входом в группу нельзя: это сломало бы готовые схемы.
    // Проверяем именно цель Konva: в readOnly только эти области и слушают.
    if (e.target !== e.target.getStage()) return;

    const el = containerAtPointer();
    if (el) enterGroup(el.key);
  };

  /**
   * Монитор: меню выбора, которое построил `onClick` вызовом `showMenu(items)` (движок
   * исполняет скрипт, рисуем мы). Вид — от элемента со скриптом, как у его обычного меню.
   *
   * У элемента с `onDoubleClick` меню откладывается на окно двойного клика: иначе второй
   * клик попал бы в пункт. Konva шлёт `click` и на втором клике — второй запрос в окне
   * означает двойной клик, и меню не показываем вовсе (как в handleMonitorClick).
   */
  const { isPending, schedule } = pendingMenu;
  useEffect(() => {
    if (!readOnly || archive) return;
    setRuntimeMenuHandler(({ elementKey, point, items }) => {
      if (isPending()) {
        cancelPendingMonitorMenu();
        return;
      }
      const el = useEditorStore.getState().elements.find(e => e.key === elementKey);
      if (!el) return;
      const open = () => setContextMenu({
        x: point.x,
        y: point.y,
        items: buildChoiceMenu(el, items, { closeMenu, isLive: isRuntimeLive(), point }),
        settings: readMonitorMenu(el.monitorMenu),
      });
      const dblClickMatters = el.events?.some(ev => ev.event_type === "onDoubleClick" && ev.handler?.code?.trim());
      if (!dblClickMatters) { open(); return; }
      schedule(open);
    });
    return () => setRuntimeMenuHandler(null);
  }, [readOnly, archive, closeMenu, cancelPendingMonitorMenu, isPending, schedule, setContextMenu]);

  return { handleMonitorContextMenu, handleMonitorClick, handleMonitorDblClick };
}
