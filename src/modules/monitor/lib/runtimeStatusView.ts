import type {Tone} from "@/shared/ui/tone";
import type {RuntimeStatus} from "../model/engine/runtimeConnection";

/** Подпись и цвет статуса соединения монитора. */
export const STATUS_VIEW: Record<RuntimeStatus, {label: string; tone: Tone}> = {
  connecting: {label: "Подключение…", tone: "warning"},
  // «Подключено», а не «Живые данные»: так уже называется переключатель режима рядом, и без
  // связи активное «Живые данные» стояло рядом с «Нет соединения» (#6 п. 2).
  live: {label: "Подключено", tone: "success"},
  reconnecting: {label: "Переподключение…", tone: "warning"},
  closed: {label: "Нет соединения", tone: "neutral"},
  // Окончательный отказ: код закрытия 1003 либо 409 на создание сессии (проект не введён
  // в эксплуатацию). Реконнект не запускается — причина показывается оператору прямо на
  // холсте, иначе выключенный проект выглядел бы неисправностью экрана.
  rejected: {label: "Соединение отклонено", tone: "destructive"},
  // Код закрытия 4403: права в проекте отозваны. Монитор сам уходит к выбору проекта.
  revoked: {label: "Доступ отозван", tone: "destructive"},
};
