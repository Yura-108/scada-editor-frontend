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
  /** id внешней подписи: триггер — кнопка, `htmlFor` её не подписывает. */
  labelId?: string;
}

export const MultiSelect = ({ options, selected, onChange, placeholder, icon, disabled, isLoading, labelId }: MultiSelectProps) => {
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
          aria-labelledby={labelId}
          disabled={disabled || isLoading}
          className={`w-full flex items-center justify-between pl-14 pr-5 py-4 rounded-2xl border-2 outline-none transition-all duration-300 text-lg font-medium relative bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100
            ${disabled ? 'opacity-60 cursor-not-allowed border-gray-100 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900/60' : 'border-gray-200 dark:border-neutral-700 hover:border-purple-400 focus:border-purple-500 dark:hover:border-purple-500 dark:focus:border-purple-400 cursor-pointer'}`}
        >
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
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
                <span key={val} className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200 text-sm px-2.5 py-1 rounded-lg">
                  {label}
                  {/* Крестик — мышиная сокращёнка: внутри <button> вложенную кнопку
                      разместить нельзя, поэтому от скринридера он скрыт. Снять
                      выбор с клавиатуры можно в самом списке ниже. */}
                  <X
                    aria-hidden
                    className="w-4 h-4 cursor-pointer hover:text-purple-900 dark:hover:text-white"
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
          className="z-dropdown w-(--radix-popover-trigger-width) bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-gray-100 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          sideOffset={8}
        >
          <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-purple-200 scrollbar-track-transparent">
            {options.length === 0 ? (
              <p className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Нет доступных опций</p>
            ) : (
              options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  // Настоящая кнопка с aria-pressed: раньше это был div, и список
                  // выбора был недоступен ни с клавиатуры, ни скринридеру.
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleOption(option.value)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors mb-1 last:mb-0
                      ${isSelected ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200' : 'hover:bg-gray-50 text-gray-700 dark:text-gray-300 dark:hover:bg-neutral-800'}`}
                  >
                    <span className="font-medium">{option.label}</span>
                    {isSelected && <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

