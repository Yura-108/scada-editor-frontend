import {toast} from "sonner";
import {useQuery} from "@tanstack/react-query";
import {getQueryClient} from "@/shared/api/queryClient";
import type {DeviceParamsLayoutType} from '../types/nodeTypes';
import {errorMessage, fetchDeviceTemplates, fetchParamLayout, type DeviceTemplateList} from "../api/devicesApi";

/**
 * Справочники базы каналов: типы параметров и шаблоны устройств (для модалок создания).
 *
 * Серверные данные — в кэше TanStack Query. Грузятся там же и тогда же, что раньше (загрузка
 * проектов в «Каналах», «Добавить параметр», «Добавить устройство»), читаются окнами создания
 * в момент открытия — реактивных читателей у них нет, поэтому только функции, без хуков.
 */
const paramTypesKey = ["devices", "param-types"] as const;
const deviceTemplatesKey = ["devices", "templates"] as const;

/** Пустой список шаблонов: форма читает `templates.length`, объект нужен всегда. */
const NO_TEMPLATES: DeviceTemplateList = {templates: []};

/** Перечитать типы параметров. Ошибка не перехватывается — её показывает вызывающий. */
export async function loadParamTypes(): Promise<void> {
  await getQueryClient().fetchQuery({queryKey: paramTypesKey, queryFn: fetchParamLayout, staleTime: 0});
}

/** Типы параметров, загруженные последними (пустой список — ещё не загружены). */
export const getParamTypes = (): DeviceParamsLayoutType[] =>
  getQueryClient().getQueryData<DeviceParamsLayoutType[]>(paramTypesKey) ?? [];

const NO_PARAM_TYPES: DeviceParamsLayoutType[] = [];

/**
 * Типы параметров для экрана, которому они нужны реактивно («Логирование» показывает название
 * типа вместо номера). Тот же кэш, что у `loadParamTypes`: загруженное «Каналами» не
 * перезапрашивается. Ошибка — пустой список: читатель покажет номер типа.
 */
export function useParamTypes(): DeviceParamsLayoutType[] {
  return useQuery({queryKey: paramTypesKey, queryFn: fetchParamLayout, staleTime: Infinity}).data
    ?? NO_PARAM_TYPES;
}

/** Перечитать шаблоны устройств. Ошибка — тост и пустой список, окно создания всё равно откроется. */
export async function loadDeviceTemplates(): Promise<void> {
  const client = getQueryClient();
  try {
    await client.fetchQuery({
      queryKey: deviceTemplatesKey,
      // Форма читает deviceTemplateList.templates.length — пустой массив вместо
      // объекта ронял модалку «Добавить» с TypeError.
      queryFn: async () => {
        const data = await fetchDeviceTemplates();
        return data?.templates ? data : NO_TEMPLATES;
      },
      staleTime: 0,
    });
  } catch (err) {
    console.error('Ошибка загрузки шаблонов устройств:', err);
    toast.error(errorMessage(err, 'Не удалось загрузить шаблоны устройств'));
    client.setQueryData(deviceTemplatesKey, NO_TEMPLATES);
  }
}

/** Шаблоны устройств, загруженные последними. */
export const getDeviceTemplates = (): DeviceTemplateList =>
  getQueryClient().getQueryData<DeviceTemplateList>(deviceTemplatesKey) ?? NO_TEMPLATES;
