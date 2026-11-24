import {bindMonitorDialogs} from "@/core/runtime";
import {openElementOptionsModal} from "../ui/ElementOptionsModal";
import {openObjectInspectorModal} from "../ui/ObjectInspectorModal";
import {openTrendModal} from "../ui/TrendModal";

/**
 * Регистрирует окна монитора для меню элемента на холсте (см. `core/runtime/monitorDialogs`).
 * Вызывается на уровне модуля каждой страницы с холстом — до первого клика по элементу.
 */
export const registerMonitorDialogs = () =>
  bindMonitorDialogs({
    openTrend: openTrendModal,
    openElementOptions: openElementOptionsModal,
    openObjectInspector: openObjectInspectorModal,
  });
