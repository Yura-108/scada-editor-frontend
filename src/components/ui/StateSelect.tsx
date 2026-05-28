import * as Select from "@radix-ui/react-select";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "lucide-react";
import React, {useEffect} from "react";
import {useEditorStore} from "@/store/useEditorStore";

interface Props {
  elementKey: string;
  states: {id: string; name: string; isDefault?: boolean}[];
}

export function StateSelect({elementKey, states}: Props) {
  const defaultStateId = states.find(state => state.isDefault)?.id ?? states[0]?.id ?? "";
  const activeStateId = useEditorStore(
    state => state.currentComponentStateByElementKey[elementKey] ?? ""
  );
  const {setCurrentComponentStateId} = useEditorStore();

  const normalizedSelectedValue = states.some(state => state.id === activeStateId)
    ? activeStateId
    : defaultStateId;

  useEffect(() => {
    if (!normalizedSelectedValue) return;

    if (activeStateId !== normalizedSelectedValue) {
      setCurrentComponentStateId(elementKey, normalizedSelectedValue);
    }
  }, [activeStateId, elementKey, normalizedSelectedValue, setCurrentComponentStateId]);

  return (
    <Select.Root
      value={normalizedSelectedValue}
      onValueChange={(value) => setCurrentComponentStateId(elementKey, value)}
    >
      <Select.Trigger
        className={`
          group
          w-full inline-flex items-center justify-between gap-2
          rounded-lg px-3 py-2
          bg-white dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700
          text-gray-800 dark:text-gray-200 text-sm font-medium
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
            className="text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:text-gray-300 transition-colors"
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
            rounded-lg border border-gray-200 dark:border-gray-900
            bg-white dark:bg-[#0d0d0d] text-gray-800 dark:text-gray-200
            shadow-2xl shadow-black/50
            animate-in fade-in-60 zoom-in-95 duration-150
            data-[state=open]:animate-in
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-60
            data-[state=closed]:zoom-out-95
          `}
        >
          <Select.ScrollUpButton className="flex h-8 items-center justify-center bg-gray-100 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 hover:bg-gray-700/70 transition-colors">
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

          <Select.ScrollDownButton className="flex h-8 items-center justify-center bg-gray-100 dark:bg-gray-800/70 text-gray-600 dark:text-gray-400 hover:bg-gray-700/70 transition-colors">
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
        data-highlighted:bg-gray-700/80 data-highlighted:text-gray-900 dark:text-white
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

