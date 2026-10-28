'use client';

import {create} from 'zustand/react';
import {devtools} from 'zustand/middleware';
import {toast} from "sonner";
import type {DeviceParamsLayoutType} from '@/types/nodeTypes';
import {errorMessage, fetchDeviceTemplates, fetchParamLayout, type DeviceTemplateList} from "../api/devicesApi";

/** Справочники базы каналов: типы параметров и шаблоны устройств (для модалок создания). */
interface DeviceDictionariesState {
  getParamsTypes: () => Promise<void>;
  paramsTypes: DeviceParamsLayoutType[];
  deviceTemplateList: DeviceTemplateList;
  loadDeviceTemplateList: () => Promise<void>;
}

export const useDeviceDictionaries = create<DeviceDictionariesState>()(
  devtools(
    (set) => ({
      paramsTypes: [],
      // Тип — объект с полем templates; пустой массив здесь ронял
      // OpenCreateDeviceModal (`deviceTemplateList.templates.length`) с TypeError.
      deviceTemplateList: {templates: []},
      getParamsTypes: async () => {
        set({paramsTypes: await fetchParamLayout()});
      },
      loadDeviceTemplateList: async () => {
        try {
          const data = await fetchDeviceTemplates();
          // Форма читает deviceTemplateList.templates.length — пустой массив вместо
          // объекта ронял модалку «Добавить» с TypeError.
          set({deviceTemplateList: data?.templates ? data : {templates: []}});
        } catch (err) {
          console.error('Ошибка загрузки шаблонов устройств:', err);
          toast.error(errorMessage(err, 'Не удалось загрузить шаблоны устройств'));
          set({deviceTemplateList: {templates: []}});
        }
      },
    }),
  ),
);
