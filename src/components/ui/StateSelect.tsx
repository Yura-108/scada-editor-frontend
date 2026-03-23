import * as Select from "@radix-ui/react-select";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "lucide-react";
import React, {useEffect, useState} from "react";
import {useEditorStore} from "@/store/useEditorStore";

interface Props {
  states: {id: string; name: string}[];
}

export function StateSelect({states}: Props) {
  const [selectedValue, setSelectedValue] = useState(states[0]?.id ?? "");
  const {selectedIds, updateElement, elements, setCurrentComponentStateId} = useEditorStore();

  useEffect(() => {
    if (states.length > 0) {
      setSelectedValue(states[0].id);
    }
  }, [selectedIds]);

  useEffect(() => {
    const selectedElement = elements.find(el => el.key === selectedIds[0]);

    if (!selectedElement) return;

    const currentState = selectedElement.states.find(state => state.id === selectedValue);

    if (!currentState) return;

    setCurrentComponentStateId(selectedValue);

    updateElement(selectedIds[0], currentState.overrides)
  }, [selectedValue]);

  return (
    <Select.Root value={selectedValue} onValueChange={setSelectedValue}>
      <Select.Trigger
        className={`
          group
          w-full inline-flex items-center justify-between gap-2
          rounded-lg px-3 py-2
          bg-neutral-900/80 border border-neutral-700
          text-gray-200 text-sm font-medium
          shadow-sm
          hover:bg-gray-750 hover:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30
          transition-all duration-200
        `}
        aria-label="Выберите состояние"
      >
        <Select.Value placeholder="Выберите состояние..." />
        <Select.Icon asChild>
          <ChevronDownIcon
            className="text-gray-400 group-hover:text-gray-300 transition-colors"
            size={18}
          />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="start"
          className={`
            w-full
            z-50
            min-w-[180px]
            overflow-hidden
            rounded-lg border border-gray-900
            bg-[#0d0d0d] text-gray-200
            shadow-2xl shadow-black/50
            animate-in fade-in-60 zoom-in-95 duration-150
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-60
            data-[state=closed]:zoom-out-95
          `}
        >
          <Select.ScrollUpButton className="flex h-8 items-center justify-center bg-gray-800/70 text-gray-400 hover:bg-gray-700/70 transition-colors">
            <ChevronUpIcon size={18} />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1">
            <Select.Group>
              <Select.Label className="px-3 py-2 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                Состояния
              </Select.Label>
              {states.map(state => (
                <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
              ))}
            </Select.Group>
          </Select.Viewport>

          <Select.ScrollDownButton className="flex h-8 items-center justify-center bg-gray-800/70 text-gray-400 hover:bg-gray-700/70 transition-colors">
            <ChevronDownIcon size={18} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default function SelectItem({
 children,
 className,
 ...props
}: React.ComponentProps<typeof Select.Item>) {
  return (
    <Select.Item
      className={`
        relative flex items-center px-4 py-2.5
        text-sm rounded-md cursor-default select-none outline-none
        data-highlighted:bg-gray-700/80 data-highlighted:text-white
        data-[state=checked]:bg-violet-900/30 data-[state=checked]:text-violet-300
        transition-colors duration-150
        ${className}
      `}
      {...props}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
        <CheckIcon size={16} className="text-violet-400" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}