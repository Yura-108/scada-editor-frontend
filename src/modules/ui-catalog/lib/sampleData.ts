import type {SelectOption} from "@/shared/ui/field/Select";
import type {VersionSummary} from "@/types/editorVersion.types";

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

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const SAMPLE_VERSIONS: VersionSummary[] = [
  {version_no: 5, kind: "MANUAL", user_name: "operator", created_at: hoursAgo(1), comment: "Добавлен насос 3"},
  {version_no: 4, kind: "AUTOSAVE", user_name: "operator", created_at: hoursAgo(3)},
  {version_no: 3, kind: "RESTORE", user_name: "admin", created_at: hoursAgo(26), restored_from: 1},
  {version_no: 2, kind: "AUTOSAVE", user_name: "admin", created_at: hoursAgo(28)},
  {version_no: 1, kind: "MANUAL", user_name: "admin", created_at: hoursAgo(50)},
];
