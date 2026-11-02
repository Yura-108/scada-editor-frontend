import React from "react";
import {AlertTriangle} from "lucide-react";
import {Checkbox} from "@/shared/ui/field/Checkbox";
import {Banner} from "@/shared/ui/Banner";
import {EmptyState} from "@/shared/ui/EmptyState";
import {scriptPlaceLabel} from "../../../lib/assistant/sceneScripts";
import {ScriptDiffView} from "./ScriptDiffView";
import type {BulkScriptEdit} from "./useBulkScriptEdit";

/**
 * Предложения помощника: по каждому скрипту — разница старого и нового кода и флажок
 * «применить». Отвергнутые проверкой — отдельно, кода у них нет.
 */
export function ProposalList({state}: {state: BulkScriptEdit}) {
  const {proposals, rejected, byId, chosen, toggleChosen} = state;
  const titleOf = (id: string) => {
    const s = byId.get(id);
    return s ? `${s.elementLabel} · ${scriptPlaceLabel(s.place)} ${s.name}` : id;
  };

  return (
    <div className="space-y-3">
      {proposals.length === 0 ? (
        <EmptyState size="sm" title="Помощник не предложил правок" description="Задание не относится к выбранным скриптам — или уточните его." />
      ) : (
        proposals.map(p => (
          <div key={p.id} className="space-y-1">
            <Checkbox
              checked={chosen.has(p.id)}
              onChange={() => toggleChosen(p.id)}
              label={<span className="font-medium">{titleOf(p.id)}</span>}
            />
            <ScriptDiffView oldCode={p.old_code} newCode={p.new_code} />
          </div>
        ))
      )}

      {rejected.length > 0 && (
        <Banner tone="warning" icon={AlertTriangle} title={`Отвергнуто проверкой: ${rejected.length}`}>
          <ul className="space-y-0.5">
            {rejected.map(r => <li key={r.id}>{titleOf(r.id)} — {r.reason}</li>)}
          </ul>
        </Banner>
      )}
    </div>
  );
}
