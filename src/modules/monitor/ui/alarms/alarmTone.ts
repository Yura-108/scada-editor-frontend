import type {AlarmTone} from "../../lib/alarms";

/** Цвета по важности: тревога — красный, сообщение — жёлтый, ответ на действие — синий. */
export const TONE_VIEW: Record<AlarmTone, {stripe: string; pill: string}> = {
  danger: {stripe: "bg-red-500", pill: "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25"},
  warning: {stripe: "bg-amber-500", pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"},
  info: {stripe: "bg-blue-500", pill: "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25"},
};

export const SMALL_BUTTON =
  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
