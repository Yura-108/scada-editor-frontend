import * as Select from "@radix-ui/react-select";
import {ChevronDown} from "lucide-react";
import React, {useEffect} from "react";
import {useEditorStore} from "@/store/useEditorStore";
import SelectItem from "@/components/ui/SelectItem";
import {
  selectContentClassName,
  selectIconClassName,
  selectScrollButtonClassName,
  selectTriggerClassName,
} from "@/components/ui/selectStyles";
import {cn} from "@/lib/utils";

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
        className={cn(selectTriggerClassName, "py-2 px-3")}
        aria-label="Выберите состояние"
      >
        <Select.Value placeholder="Выберите состояние..." />
        <Select.Icon>
          <ChevronDown className={selectIconClassName} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="start"
          className={cn(selectContentClassName, "min-w-[180px]")}
        >
          <Select.ScrollUpButton className={selectScrollButtonClassName}>
            <ChevronDown className="h-4 w-4 rotate-180" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1.5">
            <Select.Group>
              <Select.Label className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Состояния
              </Select.Label>
              {states.map(state => (
                <SelectItem key={state.id} value={state.id}>
                  {state.name}
                </SelectItem>
              ))}
            </Select.Group>
          </Select.Viewport>

          <Select.ScrollDownButton className={selectScrollButtonClassName}>
            <ChevronDown className="h-4 w-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
