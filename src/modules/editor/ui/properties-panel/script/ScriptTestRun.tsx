import React, {type Dispatch, type SetStateAction} from "react";
import {Play} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Collapsible} from "@/shared/ui/codeModalParts";
import {scriptInputClasses} from "./scriptStyles";

/** Итог тест-прогона, уже в виде текста: что сделал бы код в мониторе или чем он упал. */
export type ScriptTestOutcome = {kind: "ok" | "error"; text: string} | null;

/**
 * Тест-прогон скрипта: значение-заглушка для каждой переменной скоупа, «Выполнить» и итог.
 * В мониторе ничего не меняется — показывается только то, что код сделал бы.
 */
export function ScriptTestRun({names, mockValues, setMockValues, onRun, outcome}: {
  names: string[];
  mockValues: Record<string, string>;
  setMockValues: Dispatch<SetStateAction<Record<string, string>>>;
  onRun: () => void;
  outcome: ScriptTestOutcome;
}) {
  return (
    <Collapsible title="Тест-прогон">
      <div className="flex justify-end">
        <button
          onClick={onRun}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 hover:bg-emerald-600 text-white transition-colors"
        >
          <Play size={12} />
          Выполнить
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {names.map(varName => (
          <div key={varName} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400 font-mono shrink-0">{varName} =</span>
            <input
              type="text"
              className={cn(scriptInputClasses, "px-2 py-1 text-xs rounded-lg")}
              placeholder="значение"
              value={mockValues[varName] ?? ""}
              onChange={e => setMockValues(v => ({...v, [varName]: e.target.value}))}
            />
          </div>
        ))}
      </div>
      {outcome && (
        <div
          className={cn(
            "text-xs rounded-lg px-3 py-2 font-mono whitespace-pre-wrap",
            outcome.kind === "error" ? "bg-red-950/40 text-red-300" : "bg-emerald-950/40 text-emerald-300",
          )}
        >
          {outcome.text}
        </div>
      )}
    </Collapsible>
  );
}
