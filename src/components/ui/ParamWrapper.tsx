import {clsx} from "clsx";
import React, {ReactNode} from "react";
import {DeviceParamsType} from "@/types/nodeTypes";
import {X} from "lucide-react";

interface IParamWrapper {
  param: DeviceParamsType;
  hasChanged: boolean;
  children: ReactNode;
  onRemove?: (key: string) => void;
}

const ParamWrapper: React.FC<IParamWrapper> = ({param, hasChanged, children, onRemove}) => {
  return (
    <div
      className={clsx(
        'text-sm group relative flex flex-col h-full bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 p-4',
        hasChanged
          ? 'border-purple-400 ring-4 ring-purple-100'
          : 'border-gray-300 hover:border-gray-400',
        param.type === 'textarea'
          ? 'col-span-2'
          : 'col-span-1'
      )}
    >
      {/* Метка изменения */}
      {hasChanged && (
        <div
          className="absolute -top-3 -right-3 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
          Изменено
        </div>
      )}

      {/* Кнопка удалить */}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(param.key)}
          className="absolute top-2 right-2 w-6 h-6 p-1 rounded-full hover:bg-red-100 flex items-center justify-center text-red-600 transition-all"
          title="Удалить параметр"
        >
          <X className="w-4 h-4"/>
        </button>
      )}

      <label className="block text-sm font-semibold text-gray-700 mb-3">
        {param.name}
      </label>

      {children}
    </div>
  )
}

export default ParamWrapper;
