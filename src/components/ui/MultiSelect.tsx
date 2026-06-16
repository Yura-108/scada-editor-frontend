import React from "react";
import * as Popover from '@radix-ui/react-popover';
import {Check, ChevronDown, X} from "lucide-react";

interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  icon: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
}

export const MultiSelect = ({ options, selected, onChange, placeholder, icon, disabled, isLoading }: MultiSelectProps) => {
  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const removeOption = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled || isLoading}
          className={`w-full flex items-center justify-between pl-14 pr-5 py-4 rounded-2xl border-2 outline-none transition-all duration-300 text-lg font-medium relative bg-white
            ${disabled ? 'opacity-60 cursor-not-allowed border-gray-100 bg-gray-50' : 'border-gray-200 hover:border-purple-400 focus:border-purple-500 cursor-pointer'}`}
        >
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-purple-600">
            {icon}
          </div>

          <div className="flex-1 flex flex-wrap gap-2 overflow-hidden text-left">
            {selected.length === 0 && !isLoading && (
              <span className="text-gray-600 dark:text-gray-400">{placeholder}</span>
            )}
            {isLoading && <span className="text-purple-500 animate-pulse">Загрузка...</span>}
            {!isLoading && selected.map((val) => {
              const label = options.find((o) => o.value === val)?.label || val;
              return (
                <span key={val} className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-sm px-2.5 py-1 rounded-lg">
                  {label}
                  <X
                    className="w-4 h-4 cursor-pointer hover:text-purple-900"
                    onClick={(e) => removeOption(e, val)}
                  />
                </span>
              );
            })}
          </div>

          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 ml-2 shrink-0" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-(--radix-popover-trigger-width) bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          sideOffset={8}
        >
          <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-purple-200 scrollbar-track-transparent">
            {options.length === 0 ? (
              <p className="p-4 text-center text-gray-500 text-sm">Нет доступных опций</p>
            ) : (
              options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors mb-1 last:mb-0
                      ${isSelected ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-700'}`}
                  >
                    <span className="font-medium">{option.label}</span>
                    {isSelected && <Check className="w-5 h-5 text-purple-600" />}
                  </div>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

