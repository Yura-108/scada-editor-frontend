import React, {useEffect} from "react";
import {useEditorStore} from "@/modules/editor";
import {Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue} from "@/shared/ui/field/Select";

interface Props {
  elementKey: string;
  states: {id: string; name: string; isDefault?: boolean}[];
}

export function StateSelect({elementKey, states}: Props) {
  const defaultStateId = states.find(state => state.isDefault)?.id ?? states[0]?.id ?? "";
  const activeStateId = useEditorStore(
    state => state.currentComponentStateByElementKey[elementKey] ?? ""
  );
  const setCurrentComponentStateId = useEditorStore(state => state.setCurrentComponentStateId);

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
    <Select
      value={normalizedSelectedValue}
      onValueChange={(value) => setCurrentComponentStateId(elementKey, value)}
    >
      <SelectTrigger aria-label="Выберите состояние">
        <SelectValue placeholder="Выберите состояние..." />
      </SelectTrigger>
      <SelectContent className="min-w-[180px]">
        <SelectGroup>
          <SelectLabel>Состояния</SelectLabel>
          {states.map(state => (
            <SelectItem key={state.id} value={state.id}>
              {state.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
