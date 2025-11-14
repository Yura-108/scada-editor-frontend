import * as React from "react";
import type {DeviceParamsType} from "../../types/nodeType.ts";
import './DeviceParams.scss';
import {type FormEvent, useEffect, useState} from "react";
import {applyChangesParams} from "../../utils/applyChangesParams.ts";
import SelectContextMenu from "../SelectContextMenu/SelectContextMenu.tsx";

interface DeviceParamsProps {
  deviceParams: DeviceParamsType[];
  isDirty: boolean;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setInitialDeviceParams: React.Dispatch<React.SetStateAction<DeviceParamsType[]>>;
  nodeType: string;
}

const DeviceParams: React.FC<DeviceParamsProps> = ({
    deviceParams,
    isDirty,
    setIsDirty,
    setInitialDeviceParams,
    nodeType
  }) => {
  const [optionParams, setOptionParams] = useState<DeviceParamsType[]>(deviceParams.filter(param => param.type === 'option'));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const {name, type} = e.target;

    let newValue: string | boolean;

    if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      newValue = target.checked;
    } else {
      newValue = e.target.value;
    }

    const originalParam = deviceParams.find(param => {
      return (
        `input-${param.key}` === name ||
        `textarea-${param.key}` === name
      );
    });

    if (!originalParam) return;

    const originalValue = originalParam.value;

    if (newValue !== originalValue) {
      setIsDirty(true);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await applyChangesParams(e.currentTarget, deviceParams, setIsDirty, setInitialDeviceParams);
  };

  useEffect(() => {
    setOptionParams(deviceParams.filter(param => param.type === 'option'))
  }, [deviceParams])

  return (
    <form onSubmit={handleSubmit} className={"params"}>
      {deviceParams.map(param => {
        switch (param.type) {
          case 'input':
            return (
              <div key={param.key} className={"input__container"}>
                <label htmlFor={`input-${param.key}`}>{param.name}</label>
                <input
                  id={`input-${param.key}`}
                  name={`input-${param.key}`}
                  key={param.key}
                  type={"text"}
                  onChange={handleChange}
                  defaultValue={param.value}/>
              </div>
            )
          case 'checkbox':
            return (
              <div key={param.key} className={"checkbox__container"}>
                <input
                  name={`input-${param.key}`}
                  id={`input-${param.key}`}
                  type="checkbox"
                  onChange={handleChange}
                  defaultChecked={Boolean(param.value)}
                />
                <label htmlFor={`input-${param.key}`}>{param.name}</label>
              </div>
            )
          case 'textarea':
            return (
              <div key={param.key} className={"textarea__container"}>
                <label htmlFor={`textarea-${param.key}`}>{param.name}</label>
                <textarea
                  name={`textarea-${param.key}`}
                  id={`textarea-${param.key}`}
                  onChange={handleChange}
                  defaultValue={param.value}
                >
                  </textarea>
              </div>
            )
          case 'span':
            return <span key={param.key}>{param.value}</span>
        }
      })}
      {nodeType.includes("dev") && (
        <>
          <SelectContextMenu parentKey={nodeType} name={"general_param"} title={"Общие параметры"} value={optionParams.filter(param => param.name === "Общие параметры")}/>
          <SelectContextMenu parentKey={nodeType} name={"init_param"} title={"Параметры инициализации"} value={optionParams.filter(param => param.name === "Параметры инициализации")}/>
          <SelectContextMenu parentKey={nodeType} name={"completion_param"} title={"Параметры завершения"} value={optionParams.filter(param => param.name === "Параметры завершения")}/>
        </>
      )}
      {nodeType.includes("sub") && (
        <SelectContextMenu parentKey={nodeType} name={"subtype_param"} title={"Общие параметры"} value={optionParams.filter(param => param.name === "Общие параметры")}/>
      )}
      {nodeType.includes("cha") && (
        <SelectContextMenu parentKey={nodeType} name={"channel_param"} title={"Общие параметры"} value={optionParams.filter(param => param.name === "Общие параметры")}/>
      )}
      <button type="submit" disabled={!isDirty}>
        Применить
      </button>

    </form>
  )
}

export default DeviceParams;

