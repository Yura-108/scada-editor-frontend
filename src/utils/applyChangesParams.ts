import type {DeviceParamsType} from "../types/nodeType.ts";
import * as React from "react";
import {patchParam} from "./treeApi.ts";

export const applyChangesParams = async (
  form: HTMLFormElement,
  deviceParams: DeviceParamsType[],
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>,
  setInitialDeviceParams: React.Dispatch<React.SetStateAction<DeviceParamsType[]>>
) => {
  const formData = new FormData(form);
  const patchPayload: { key: string; value: string }[] = [];

  deviceParams.forEach(param => {
    const inputName = `input-${param.key}`;
    const textareaName = `textarea-${param.key}`;

    switch (param.type) {
      case 'input': {
        const currentValue = formData.get(inputName);
        if (currentValue !== param.value) {
          patchPayload.push({ key: param.key, value: currentValue });
        }
        break;
      }
      case 'textarea': {
        const currentValue = formData.get(textareaName);
        if (currentValue !== param.value) {
          patchPayload.push({ key: param.key, value: currentValue });
        }
        break;
      }
      case 'checkbox': {
        const isChecked = formData.get(inputName) === 'on'; // true if checked
        if (isChecked !== param.value) {
          patchPayload.push({ key: param.key, value: isChecked });
        }
        break;
      }
    }
  });

  const updateParams: DeviceParamsType[] = deviceParams.map(param => {
    const inputName = `input-${param.key}`;
    const textareaName = `textarea-${param.key}`;

    switch (param.type) {
      case 'input': {
        const value = formData.get(inputName)?.toString() ?? '';
        return { ...param, value };
      }
      case 'textarea': {
        const value = formData.get(textareaName)?.toString() ?? '';
        return { ...param, value };
      }
      case 'checkbox': {
        const isChecked = formData.get(inputName) === 'on';
        return { ...param, value: isChecked };
      }
      default:
        return param;
    }
  });

  if (patchPayload.length === 0) {
    console.log('Нет изменений');
    return;
  }
  try {
    await patchParam(patchPayload);
    console.log('Изменения применены:', deviceParams);
    setInitialDeviceParams(updateParams);
    setIsDirty(false);
  } catch (err) {
    console.error('Ошибка при отправке PATCH:', err);
  }
};
