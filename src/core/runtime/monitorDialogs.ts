/**
 * Окна монитора, которые открывает меню элемента на холсте: «Открыть тренд», «Опции»,
 * «Инспектор».
 *
 * Меню строит холст редактора (общий для редактора и монитора), а окна живут в мониторе.
 * Модули не импортируют друг друга, поэтому окна регистрирует монитор сам
 * (`registerMonitorDialogs` в `@/modules/monitor`), а вызывает его каждая страница с холстом:
 * в редакторе меню монитора открывается при просмотре версии, и «Открыть тренд» там работает.
 */
export interface MonitorDialogs {
  openTrend: (args: {elementKey: string}) => void;
  openElementOptions: (args: {elementKey: string}) => void;
  openObjectInspector: (args?: {initialObjectId?: number}) => void;
}

let dialogs: MonitorDialogs | null = null;

export const bindMonitorDialogs = (d: MonitorDialogs) => {
  dialogs = d;
};

export const monitorDialogs = (): MonitorDialogs => {
  if (!dialogs) throw new Error("Окна монитора не зарегистрированы: registerMonitorDialogs не вызывался");
  return dialogs;
};
