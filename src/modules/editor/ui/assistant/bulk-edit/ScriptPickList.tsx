import React, {useMemo} from "react";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {EmptyState} from "@/shared/ui/EmptyState";
import {scriptPlaceLabel, type SceneScript} from "../../../lib/assistant/sceneScripts";
import {ASSISTANT_EDIT_MAX_CODE, ASSISTANT_EDIT_MAX_SCRIPTS} from "../../../types/assistant.types";
import {isTooLong, type BulkScriptEdit} from "./useBulkScriptEdit";

/** Выбор скриптов для правки, сгруппированный по элементам. */
export function ScriptPickList({state}: {state: BulkScriptEdit}) {
  const {scripts, selected, toggleSelected, setAllSelected, tooMany} = state;

  const groups = useMemo(() => {
    const map = new Map<string, SceneScript[]>();
    for (const s of scripts) map.set(s.elementKey, [...(map.get(s.elementKey) ?? []), s]);
    return [...map.values()];
  }, [scripts]);

  if (!scripts.length) {
    return <EmptyState size="sm" title="В сцене нет скриптов" />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Выбрано {selected.size} из {scripts.length}</span>
        <button type="button" className="text-primary hover:underline" onClick={() => setAllSelected(true)}>все</button>
        <button type="button" className="text-primary hover:underline" onClick={() => setAllSelected(false)}>ни одного</button>
        {tooMany && <span className="text-destructive">не больше {ASSISTANT_EDIT_MAX_SCRIPTS} за запрос</span>}
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
        {groups.map(group => (
          <div key={group[0].elementKey} className="px-3 py-2 space-y-1">
            <div className="text-xs font-medium text-foreground">{group[0].elementLabel}</div>
            {group.map(s => (
              <Checkbox
                key={s.id}
                checked={selected.has(s.id)}
                disabled={isTooLong(s)}
                onChange={() => toggleSelected(s.id)}
                label={<>
                  {scriptPlaceLabel(s.place)} <span className="font-mono">{s.name}</span>
                  {isTooLong(s) && (
                    <span className="text-xs text-muted-foreground"> — длиннее {ASSISTANT_EDIT_MAX_CODE} символов</span>
                  )}
                </>}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
