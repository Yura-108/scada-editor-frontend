import type {SelectOption} from "@/shared/ui/field/Select";
import type {VersionSummary} from "@/core/project";

/** Выдуманные данные каталога — к сторам и бэкенду каталог не обращается. */

export const SAMPLE_OPTIONS: SelectOption[] = [
  {value: "auto", label: "Автомат"},
  {value: "manual", label: "Ручной"},
  {value: "service", label: "Обслуживание"},
  {value: "off", label: "Отключён", disabled: true},
];

export const SAMPLE_PROJECTS: {value: string; label: string; prod?: number}[] = [
  {value: "1", label: "Цех розлива", prod: 12},
  {value: "2", label: "Котельная", prod: 3},
  {value: "3", label: "Очистные сооружения"},
  {value: "4", label: "Склад сырья"},
];

// Даты фиксированные: от Date.now() сервер и браузер получали разные секунды — ошибка гидрации.
export const SAMPLE_VERSIONS: VersionSummary[] = [
  {version_no: 5, kind: "MANUAL", user_name: "operator", created_at: "2026-10-30T09:15:00Z", comment: "Добавлен насос 3"},
  {version_no: 4, kind: "AUTOSAVE", user_name: "operator", created_at: "2026-10-30T07:05:00Z"},
  {version_no: 3, kind: "RESTORE", user_name: "admin", created_at: "2026-10-29T08:40:00Z", restored_from: 1},
  {version_no: 2, kind: "AUTOSAVE", user_name: "admin", created_at: "2026-10-29T06:20:00Z"},
  {version_no: 1, kind: "MANUAL", user_name: "admin", created_at: "2026-10-28T10:00:00Z"},
];
