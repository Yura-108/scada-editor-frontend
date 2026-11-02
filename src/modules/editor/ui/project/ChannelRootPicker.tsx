import React from "react";
import {Field} from "@/shared/ui/field/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/field/Select";
import type {ChannelRootState} from "./useChannelRoot";

/** Площадка и база каналов — два выпадающих списка; состояние — `useChannelRoot`. */
export function ChannelRootPicker({state}: {state: ChannelRootState}) {
  const {sites, site, setSite, roots, root, setRoot, isLoadingRoots} = state;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Площадка">
        <Select value={site} onValueChange={setSite}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите площадку…" />
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="База каналов"
        hint={site && !isLoadingRoots && roots.length === 0 ? "На этой площадке баз нет" : undefined}
      >
        <Select value={root} onValueChange={setRoot} disabled={!site || isLoadingRoots}>
          <SelectTrigger>
            <SelectValue placeholder={isLoadingRoots ? "Загрузка…" : "Выберите базу…"} />
          </SelectTrigger>
          <SelectContent>
            {/* Подпись — последний сегмент, значение — полный путь: именно он уезжает
                в `channel_root`. */}
            {roots.map((key) => (
              <SelectItem key={key} value={key}>{key.split(".").pop() || key}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
